<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\Organization;
use App\Models\User;
use App\Services\EntryIngestionService;
use Illuminate\Http\Request;

/**
 * Bridge → Laravel ingest. Authenticated by HMAC (X-Webhook-Signature = hex hmac_sha256(raw body, INGEST_SECRET)).
 * Org/user come from X-Organization-ID / X-User-ID headers (legacy body group_id/user_id accepted as fallback).
 */
class EntryIngestionController extends Controller
{
    public function store(Request $request)
    {
        $secret = (string) config('services.ingest.secret');
        $sig = (string) $request->header('X-Webhook-Signature');
        if ($secret === '' || ! hash_equals(hash_hmac('sha256', $request->getContent(), $secret), $sig)) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }
        $request->validate(EntryIngestionService::rules() + ['output.entries' => ['required', 'array', 'min:1']]);

        $org = Organization::findOrFail($request->header('X-Organization-ID') ?? $request->input('group_id'));
        $userId = $request->header('X-User-ID') ?? $request->input('user_id');
        $user = $userId ? User::find($userId) : null;
        if ($user && ! $user->membershipFor($org)) {
            return response()->json(['message' => 'User is not a member of this organization.'], 403);
        }

        $result = EntryIngestionService::ingest($org, $request->input('output.entries'), $user);

        return ['transactions' => TransactionResource::collection($result['transactions']), 'metadata' => $result['metadata']];
    }
}
