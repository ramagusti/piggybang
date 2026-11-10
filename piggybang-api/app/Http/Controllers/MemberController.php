<?php

namespace App\Http\Controllers;

use App\Http\Resources\MemberResource;
use App\Http\Resources\OrganizationResource;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Notifications\OrganizationInvitation;
use App\Services\OrganizationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MemberController extends Controller
{
    public function index(Organization $org)
    {
        return MemberResource::collection($org->memberships()->with('user')->orderBy('id')->get());
    }

    public function invite(Request $request, Organization $org)
    {
        $data = $request->validate(['email' => 'required|email|max:255', 'role' => 'required|in:admin,member,viewer']);
        $this->assertRoleAllowed($org, $data['role']);
        $email = Str::lower($data['email']);
        $existingUser = User::where('email', $email)->first();
        $dupe = $org->memberships()->where(fn ($q) => $q->where('email', $email)->when($existingUser, fn ($q) => $q->orWhere('user_id', $existingUser->id)))->exists();
        if ($dupe) {
            throw ValidationException::withMessages(['email' => ['Orang ini sudah anggota atau sudah diundang.']]);
        }
        OrganizationService::assertSeatAvailable($org);

        $membership = $org->memberships()->create([
            'email' => $email, 'role' => $data['role'], 'invitation_token' => Str::random(48), 'joined_at' => now(),
        ]);
        Notification::route('mail', $email)->notify(new OrganizationInvitation($membership, $request->user()->name));

        return (new MemberResource($membership))->response()->setStatusCode(201);
    }

    public function showInvitation(string $token)
    {
        $m = Membership::with('organization')->where('invitation_token', $token)->whereNull('user_id')->firstOrFail();

        return ['organization' => $m->organization->only(['id', 'name']), 'email' => $m->email, 'role' => $m->role];
    }

    public function join(Request $request, Organization $org, string $token)
    {
        $m = $org->memberships()->where('invitation_token', $token)->whereNull('user_id')->firstOrFail();

        return new OrganizationResource(self::accept($m, $request->user()));
    }

    /** Bind a pending invite to a user (idempotent if already a member). */
    public static function accept(Membership $m, User $user): Organization
    {
        $org = $m->organization;
        if ($user->membershipFor($org)) {
            $m->delete();
        } else {
            $m->update(['user_id' => $user->id, 'email' => $user->email, 'invitation_token' => null, 'invitation_accepted_at' => now(), 'joined_at' => now()]);
        }
        $user->update(['current_organization_id' => $org->id]);

        return $org;
    }

    public function update(Request $request, Organization $org, int $user)
    {
        $role = $request->validate(['role' => 'required|in:admin,member,viewer'])['role'];
        $m = $this->findMember($org, $user);
        $this->assertRoleAllowed($org, $role);
        $m->update(['role' => $role]);

        return new MemberResource($m->load('user'));
    }

    public function destroy(Organization $org, int $user)
    {
        $this->findMember($org, $user)->delete();

        return response()->noContent();
    }

    /** {user} is a user id, or with ?pending=1 a pending invite's membership id. Owner is immutable. */
    private function findMember(Organization $org, int $id): Membership
    {
        $m = request()->boolean('pending')
            ? $org->memberships()->whereNull('user_id')->whereKey($id)->firstOrFail()
            : $org->memberships()->where('user_id', $id)->firstOrFail();
        abort_if($m->role === 'owner', 422, 'Pemilik tidak bisa diubah atau dihapus.');

        return $m;
    }

    private function assertRoleAllowed(Organization $org, string $role): void
    {
        if ($role !== 'member' && ! $org->isPro()) {
            throw OrganizationService::planLimit('Peran Admin/Hanya Lihat hanya untuk Pro.');
        }
    }
}
