<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'ingest' => ['secret' => env('INGEST_SECRET')],

    'ai' => [
        'base_url' => env('AI_BASE_URL', 'https://api.openai.com/v1'), // 9Router or any OpenAI-compatible gateway
        'key' => env('AI_API_KEY'),
        'model' => env('AI_MODEL', 'gpt-4o-mini'),
        'vision_model' => env('AI_VISION_MODEL', 'gpt-4o'),
    ],

    'meta' => [
        'graph_version' => env('META_GRAPH_VERSION', 'v21.0'),
        'token' => env('META_SYSTEM_USER_TOKEN'),
        'app_secret' => env('META_APP_SECRET'),
        'verify_token' => env('META_WEBHOOK_VERIFY_TOKEN'),
        'waba_id' => env('META_WABA_ID'),
        'platform_phone' => env('META_PLATFORM_PHONE'),                       // e.g. +6281234567890 (All-In)
        'platform_phone_number_id' => env('META_PLATFORM_PHONE_NUMBER_ID'),
    ],

    'stripe' => [
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'xendit' => [
        'secret' => env('XENDIT_SECRET_KEY'),
        'callback_token' => env('XENDIT_CALLBACK_TOKEN'),
        // Invoices only offer these (Xendit codes; each must be activated in the Xendit dashboard). Bank transfer /
        // VA (Rp 9.000 + Rp 4.000) is left out on purpose: it eats up to ~29% of a monthly Pro payment.
        'payment_methods' => array_values(array_filter(explode(',', (string) env('XENDIT_PAYMENT_METHODS', 'QRIS,OVO,DANA,SHOPEEPAY,LINKAJA')))),
    ],

    // Spec: Free keeps 2 years of transactions. Off by default: enabling permanently deletes older rows nightly.
    'retention' => ['free_years_enabled' => (bool) env('FREE_RETENTION_ENABLED', false)],

    'supabase' => [
        'url' => env('SUPABASE_URL'),
        'anon_key' => env('SUPABASE_ANON_KEY'),
        'jwt_secret' => env('SUPABASE_JWT_SECRET'),
    ],

];
