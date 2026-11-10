<?php

// Spec: only piggybang.app + subdomains (plus local dev origins from FRONTEND_URL).
return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter([env('FRONTEND_URL', 'http://localhost:3000')]),
    'allowed_origins_patterns' => array_filter([env('CORS_ORIGIN_PATTERN', '#^https://([a-z0-9-]+\.)?piggybang\.app$#')]),
    'allowed_headers' => ['*'],
    'exposed_headers' => ['Content-Disposition'],
    'max_age' => 3600,
    'supports_credentials' => false, // Bearer tokens, no cookies
];
