<?php

namespace App\Support;

/** SSRF guard for user-supplied URLs: https only, host must resolve to public IPs. */
class SafeUrl
{
    public static function isPublicHttps(string $url): bool
    {
        $parts = parse_url($url);
        if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
            return false;
        }
        $ips = gethostbynamel($parts['host']) ?: [];
        if (! $ips) {
            return false;
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
        }

        return true;
    }
}
