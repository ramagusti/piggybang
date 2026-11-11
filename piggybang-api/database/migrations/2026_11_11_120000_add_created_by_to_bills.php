<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Who added a bill (bills are shared by the team). Add-only; existing bills stay null. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bills', fn (Blueprint $t) => $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete());
    }

    public function down(): void
    {
        Schema::table('bills', fn (Blueprint $t) => $t->dropConstrainedForeignId('created_by'));
    }
};
