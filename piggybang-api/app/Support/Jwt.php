<?php

namespace App\Support;

/** Minimal HS256 JWT signer (Supabase Realtime tokens). */
class Jwt
{
    public static function encode(array $claims, string $secret): string
    {
        $b64 = fn ($v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');
        $head = $b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body = $b64(json_encode($claims));

        return "$head.$body.".$b64(hash_hmac('sha256', "$head.$body", $secret, true));
    }
}
