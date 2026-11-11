<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** In-app tour per user: last step reached (resume + drop-off), and how it ended. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('tour_status', 12)->nullable(); // null = not finished yet, completed, skipped
            $t->string('tour_step', 40)->nullable();
            $t->timestampTz('tour_finished_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['tour_status', 'tour_step', 'tour_finished_at']));
    }
};
