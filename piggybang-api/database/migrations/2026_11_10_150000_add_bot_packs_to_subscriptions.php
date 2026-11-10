<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Additive only: add-on packs of extra WhatsApp bot replies per subscription. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', fn (Blueprint $t) => $t->unsignedInteger('bot_packs')->default(0));
    }

    public function down(): void
    {
        Schema::table('subscriptions', fn (Blueprint $t) => $t->dropColumn('bot_packs'));
    }
};
