<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_rules', fn (Blueprint $t) => $t->boolean('ai_assign')->default(false));
    }

    public function down(): void
    {
        Schema::table('user_rules', fn (Blueprint $t) => $t->dropColumn('ai_assign'));
    }
};
