<?php

namespace App\Support;

/**
 * Per-request / per-queue-job memo (bound as a scoped singleton, so Laravel resets it between jobs).
 * Flushed on any write to the models it caches from (see AppServiceProvider), so it never serves stale data.
 */
class Memo
{
    private array $items = [];

    public static function get(string $key, callable $compute): mixed
    {
        $memo = app(self::class);

        return array_key_exists($key, $memo->items) ? $memo->items[$key] : $memo->items[$key] = $compute();
    }

    public static function flush(): void
    {
        app(self::class)->items = [];
    }
}
