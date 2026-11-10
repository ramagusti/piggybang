<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug', 100)->unique();
            $table->foreignId('owner_id')->constrained('users');
            $table->string('plan', 20)->default('free');
            $table->integer('member_limit')->default(2);
            $table->string('whatsapp_mode', 20)->nullable();
            $table->jsonb('settings')->default('{}');
            $table->timestampTz('trial_ends_at')->nullable();
            $table->timestampsTz();
        });

        Schema::create('memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete(); // null = pending invite
            $table->string('email')->nullable();                                         // invitee email
            $table->string('role', 20)->default('member');
            $table->string('invitation_token', 100)->nullable()->unique();
            $table->timestampTz('invitation_accepted_at')->nullable();
            $table->timestampTz('joined_at')->useCurrent();
            $table->unique(['organization_id', 'user_id']);
            $table->index('user_id');
            $table->index('organization_id');
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20);
            $table->string('provider_subscription_id');
            $table->string('provider_customer_id');
            $table->string('plan', 20);
            $table->string('interval', 10)->default('monthly');
            $table->integer('extra_seats')->default(0);
            $table->string('whatsapp_mode', 20)->nullable();
            $table->string('status', 20);
            $table->timestampTz('current_period_start');
            $table->timestampTz('current_period_end');
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestampTz('trial_ends_at')->nullable();
            $table->jsonb('metadata')->default('{}');
            $table->timestampsTz();
            $table->unique(['provider', 'provider_subscription_id']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 20);
            $table->string('provider_invoice_id')->unique();
            $table->string('description');
            $table->decimal('amount', 20, 2);
            $table->string('currency', 3)->default('IDR');
            $table->string('status', 20); // pending, paid, expired, failed
            $table->string('kind', 20)->default('period'); // period, overage
            $table->jsonb('metadata')->default('{}');        // pending plan change applied when paid
            $table->text('url')->nullable();
            $table->timestampTz('paid_at')->nullable();
            $table->timestampsTz();
        });

        Schema::create('whatsapp_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('mode', 20);
            $table->string('phone_number', 30)->nullable();
            $table->string('phone_number_id', 100)->nullable();
            $table->string('waba_id', 100)->nullable();
            $table->text('access_token_enc')->nullable();
            $table->string('webhook_url', 500)->nullable();
            $table->string('verify_token', 100)->nullable();
            $table->string('status', 20)->default('pending');
            $table->string('verification_code', 20)->nullable()->index();
            $table->timestampTz('connected_at')->nullable();
            $table->timestampTz('last_webhook_at')->nullable();
            $table->integer('monthly_conversations')->default(0);
            $table->timestampTz('conversation_reset_at')->nullable();
            $table->jsonb('metadata')->default('{}');
            $table->timestampsTz();
        });

        // Which WhatsApp senders write into which org (routing for messages hitting a number).
        Schema::create('whatsapp_senders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('phone', 30);
            $table->string('channel_phone_number_id', 100); // which business number they talk to
            $table->timestampTz('last_message_at')->nullable();
            $table->timestampsTz();
            $table->unique(['phone', 'channel_phone_number_id']);
        });

        Schema::create('transaction_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10);
            $table->string('name', 100);
            $table->string('icon', 50)->nullable();
            $table->string('color', 7)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_system')->default(false);
            $table->timestampsTz();
            $table->unique(['organization_id', 'type', 'name']);
        });

        Schema::create('user_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->foreignId('category_id')->nullable()->constrained('transaction_categories')->nullOnDelete();
            $table->string('type', 20);
            $table->decimal('limit_amount', 20, 2);
            $table->string('period', 20)->nullable();
            $table->boolean('is_primary_payday')->default(false);
            $table->string('date_condition', 20)->nullable();
            $table->string('category_name', 100)->nullable();
            $table->boolean('rollover_enabled')->default(true);
            $table->timestampsTz();
            $table->index(['organization_id', 'type']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('transaction_categories')->nullOnDelete();
            $table->string('type', 10);
            $table->decimal('amount', 20, 2);
            $table->string('currency', 3)->default('IDR');
            $table->text('description')->nullable();
            $table->string('actor', 100)->nullable();
            $table->timestampTz('transaction_time');
            $table->text('proof_url')->nullable();
            $table->string('source', 20)->default('web');
            $table->decimal('confidence', 3, 2)->nullable();
            $table->jsonb('metadata')->default('{}');
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->index(['organization_id', 'transaction_time']);
            $table->index(['organization_id', 'category_id']);
            $table->index(['organization_id', 'user_id']);
            $table->index(['organization_id', 'type']);
        });

        Schema::create('savings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->date('cycle_start');
            $table->date('cycle_end');
            $table->decimal('income_total', 20, 2)->default(0);
            $table->decimal('expense_total', 20, 2)->default(0);
            $table->decimal('net_savings', 20, 2)->storedAs('income_total - expense_total');
            $table->timestampTz('calculated_at')->useCurrent();
            $table->timestampsTz();
            $table->unique(['organization_id', 'cycle_start']);
        });

        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->decimal('amount', 20, 2);
            $table->string('currency', 3)->default('IDR');
            $table->date('due_date');
            $table->string('recurrence', 20)->nullable();
            $table->foreignId('category_id')->nullable()->constrained('transaction_categories')->nullOnDelete();
            $table->string('destination_account', 100)->nullable();
            $table->string('destination_number', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampTz('last_paid_at')->nullable();
            $table->timestampTz('last_notified_at')->nullable();
            $table->timestampsTz();
            $table->index(['organization_id', 'due_date']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 100);
            $table->string('auditable_type', 100)->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->ipAddress()->nullable();
            $table->text('user_agent')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['organization_id', 'created_at']);
        });

        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('from_currency', 3);
            $table->string('to_currency', 3);
            $table->decimal('rate', 20, 8);
            $table->string('source', 20)->default('manual');
            $table->timestampTz('fetched_at')->useCurrent();
            $table->unique(['from_currency', 'to_currency']);
        });
    }

    public function down(): void
    {
        foreach (['exchange_rates', 'audit_logs', 'bills', 'savings', 'transactions', 'user_rules', 'transaction_categories',
            'whatsapp_senders', 'whatsapp_connections', 'invoices', 'subscriptions', 'memberships', 'organizations'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
