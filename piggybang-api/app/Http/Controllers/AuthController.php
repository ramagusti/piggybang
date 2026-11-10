<?php

namespace App\Http\Controllers;

use App\Http\Resources\OrganizationResource;
use App\Models\Membership;
use App\Models\User;
use App\Services\OrganizationService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', PasswordRule::min(8)],
            'organization_name' => 'required_without:invitation_token|nullable|string|max:255',
            'invitation_token' => 'nullable|string|exists:memberships,invitation_token',
            'locale' => 'nullable|in:id,en',
        ]);

        [$user, $org] = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'], 'email' => $data['email'], 'password' => $data['password'],
                'locale' => $data['locale'] ?? 'id',
            ]);
            if (! empty($data['invitation_token'])) {
                $org = MemberController::accept(Membership::where('invitation_token', $data['invitation_token'])->firstOrFail(), $user);
            } else {
                $org = OrganizationService::create($user, $data['organization_name']);
            }

            return [$user, $org];
        });
        event(new Registered($user));
        $request->setUserResolver(fn () => $user); // so OrganizationResource resolves the new user's role

        return response()->json([
            'user' => $user->fresh(),
            'token' => $user->createToken('web')->plainTextToken,
            'organization' => new OrganizationResource($org),
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string', 'remember' => 'boolean']);
        $user = User::where('email', $data['email'])->first();
        if (! $user || ! $user->password || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => ['Email atau kata sandi salah.']]);
        }
        $user->update(['last_login_at' => now()]);
        $expires = ($data['remember'] ?? false) ? now()->addDays(30) : now()->addDay();

        return ['user' => $user, 'token' => $user->createToken('web', ['*'], $expires)->plainTextToken];
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        Password::sendResetLink($request->only('email'));

        // Same answer whether or not the email exists (no account enumeration).
        return ['message' => 'Jika email terdaftar, link reset sudah dikirim.'];
    }

    public function resetPassword(Request $request)
    {
        $request->validate(['token' => 'required', 'email' => 'required|email', 'password' => ['required', 'confirmed', PasswordRule::min(8)]]);
        $status = Password::reset($request->only('email', 'password', 'password_confirmation', 'token'), function (User $user, string $password) {
            $user->forceFill(['password' => $password])->save();
            $user->tokens()->delete();
            event(new PasswordReset($user));
        });
        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => [__($status)]]);
        }

        return ['message' => 'Kata sandi berhasil diubah.'];
    }

    public function verifyEmail(Request $request, int $id, string $hash)
    {
        $user = User::findOrFail($id);
        abort_unless(hash_equals($hash, sha1($user->getEmailForVerification())), 403);
        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return redirect(rtrim(config('app.frontend_url'), '/').'/verified');
    }

    public function resendVerification(Request $request)
    {
        if (! $request->user()->hasVerifiedEmail()) {
            $request->user()->sendEmailVerificationNotification();
        }

        return ['message' => 'Email verifikasi dikirim.'];
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $orgs = $user->memberships()->with('organization')->get()->map(fn ($m) => $m->organization->setRelation('viewerMembership', $m))
            ->sortByDesc(fn ($o) => $o->id === $user->current_organization_id)->values();

        return ['user' => $user, 'organizations' => OrganizationResource::collection($orgs)];
    }

    public function updateMe(Request $request)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255', 'locale' => 'sometimes|in:id,en',
            'timezone' => 'sometimes|timezone:all', 'avatar_url' => 'sometimes|nullable|url|max:2000',
        ]);
        $request->user()->update($data);

        return ['user' => $request->user()];
    }
}
