<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Additive only: plan tiers with bot-reply quotas, and per-budget WhatsApp notifications. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', fn (Blueprint $t) => $t->string('tier', 20)->default('pro'));
        Schema::table('organizations', fn (Blueprint $t) => $t->unsignedInteger('bot_quota')->default(0));
        Schema::table('user_rules', fn (Blueprint $t) => $t->boolean('notify')->default(true));
    }

    public function down(): void
    {
        Schema::table('subscriptions', fn (Blueprint $t) => $t->dropColumn('tier'));
        Schema::table('organizations', fn (Blueprint $t) => $t->dropColumn('bot_quota'));
        Schema::table('user_rules', fn (Blueprint $t) => $t->dropColumn('notify'));
    }
};
