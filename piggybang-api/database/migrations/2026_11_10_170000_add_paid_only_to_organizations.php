<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Additive only: teams beyond a user's first must be on a paid plan (locked until paid). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', fn (Blueprint $t) => $t->boolean('paid_only')->default(false));
    }

    public function down(): void
    {
        Schema::table('organizations', fn (Blueprint $t) => $t->dropColumn('paid_only'));
    }
};
