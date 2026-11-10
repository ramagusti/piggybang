<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;

/**
 * Tenant guard for /organizations/{org}/... routes. Resolves the caller's membership
 * (404 if none — don't leak existence), then checks the optional permission / Pro requirement.
 * Usage: ->middleware('org'), 'org:rules.write', 'org:transactions.view,pro'
 */
class OrganizationAccess
{
    public function handle(Request $request, Closure $next, ?string $permission = null, ?string $pro = null)
    {
        $org = $request->route('org');
        if (! $org instanceof Organization) {
            $org = Organization::find($org);
        }
        $membership = $org ? $request->user()?->membershipFor($org) : null;
        if (! $membership) {
            return response()->json(['message' => 'Organisasi tidak ditemukan.'], 404);
        }
        // Personal API tokens carry ability "org:{id}" and only work on that org while it is Pro.
        $token = $request->user()->currentAccessToken();
        if ($token && ! $request->user()->tokenCan('*') && (! $request->user()->tokenCan('org:'.$org->id) || ! $org->isPro())) {
            return response()->json(['message' => 'Token API tidak berlaku untuk organisasi ini.'], 403);
        }
        if ($permission && ! $membership->can($permission)) {
            return response()->json(['message' => 'Peran kamu tidak punya akses untuk aksi ini.'], 403);
        }
        if ($pro === 'pro' && ! $org->isPro()) {
            return response()->json(['message' => 'Fitur ini hanya untuk Pro.', 'code' => 'pro_required'], 403);
        }
        $request->attributes->set('membership', $membership);

        return $next($request);
    }
}
