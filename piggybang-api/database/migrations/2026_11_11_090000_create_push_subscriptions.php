<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Web Push (browser / installed PWA) subscriptions: one row per device. Add-only. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('endpoint', 1000)->unique();
            $t->string('p256dh');
            $t->string('auth');
            $t->timestamps();
        });
        if (DB::getDriverName() === 'pgsql') { // no policy = invisible to the browser-exposed anon key
            DB::statement('ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
