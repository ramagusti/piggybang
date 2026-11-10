<?php

use App\Http\Controllers\ApiTokenController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BillController;
use App\Http\Controllers\BillingWebhookController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\EntryIngestionController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\OcrController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\RuleController;
use App\Http\Controllers\SavingsController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\WhatsAppController;
use App\Http\Controllers\WhatsAppWebhookController;
use Illuminate\Support\Facades\Route;

// ---- Public auth (5/min) ----
Route::prefix('auth')->middleware('throttle:auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
});
Route::get('auth/verify-email/{id}/{hash}', [AuthController::class, 'verifyEmail'])->middleware('signed')->name('verification.verify');
Route::get('invitations/{token}', [MemberController::class, 'showInvitation'])->middleware('throttle:auth');

// ---- Machine endpoints ----
Route::post('entries/ingest', [EntryIngestionController::class, 'store'])->middleware('throttle:ingest');
Route::get('webhooks/whatsapp', [WhatsAppWebhookController::class, 'verify']);
Route::post('webhooks/whatsapp', [WhatsAppWebhookController::class, 'receive']);
Route::post('webhooks/stripe', [BillingWebhookController::class, 'stripe']);
Route::post('webhooks/xendit', [BillingWebhookController::class, 'xendit']);

// ---- Authenticated (60/min) ----
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/verify-email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:auth');
    Route::get('user', [AuthController::class, 'me']);
    Route::patch('user', [AuthController::class, 'updateMe']);

    Route::get('organizations', [OrganizationController::class, 'index']);
    Route::post('organizations', [OrganizationController::class, 'store']);

    // Tenant routes: membership enforced by `org`, child models resolved through the org (scopeBindings).
    Route::prefix('organizations/{org}')->scopeBindings()->group(function () {
        Route::middleware('org')->group(function () {
            Route::get('/', [OrganizationController::class, 'show']);
            Route::post('switch', [OrganizationController::class, 'switch']);
            Route::get('dashboard', [OrganizationController::class, 'dashboard']);
            Route::get('realtime-token', [OrganizationController::class, 'realtimeToken']);
            Route::get('members', [MemberController::class, 'index']);
            Route::get('categories', [CategoryController::class, 'index']);
            Route::get('rules', [RuleController::class, 'index']);
            Route::get('transactions', [TransactionController::class, 'index']);
            Route::get('transactions/{transaction}', [TransactionController::class, 'show']);
            Route::get('savings', [SavingsController::class, 'current']);
            Route::get('savings/history', [SavingsController::class, 'history']);
            Route::get('bills', [BillController::class, 'index']);
            Route::get('export/transactions', [ExportController::class, 'transactions']);
            Route::get('export/savings', [ExportController::class, 'savings']);
        });
        Route::post('join/{token}', [MemberController::class, 'join']); // caller not a member yet

        Route::middleware('org:members.manage')->group(function () {
            Route::patch('/', [OrganizationController::class, 'update']);
            Route::post('onboarding', [OrganizationController::class, 'onboarding']);
            Route::post('invite', [MemberController::class, 'invite']);
            Route::patch('members/{user}', [MemberController::class, 'update']);
            Route::delete('members/{user}', [MemberController::class, 'destroy']);
        });
        Route::delete('/', [OrganizationController::class, 'destroy'])->middleware('org:organization.delete');

        Route::middleware('org:categories.write')->group(function () {
            Route::post('categories', [CategoryController::class, 'store']);
            Route::post('categories/reorder', [CategoryController::class, 'reorder']);
            Route::patch('categories/{category}', [CategoryController::class, 'update']);
            Route::delete('categories/{category}', [CategoryController::class, 'destroy']);
        });
        Route::middleware('org:rules.write')->group(function () {
            Route::post('rules', [RuleController::class, 'store']);
            Route::patch('rules/{rule}', [RuleController::class, 'update']);
            Route::delete('rules/{rule}', [RuleController::class, 'destroy']);
        });
        Route::middleware('org:transactions.write')->group(function () {
            Route::post('transactions', [TransactionController::class, 'store']);
            Route::post('transactions/import', [TransactionController::class, 'import']);
            Route::post('transactions/split', [TransactionController::class, 'split']);
            Route::patch('transactions/{transaction}', [TransactionController::class, 'update']);
            Route::delete('transactions/{transaction}', [TransactionController::class, 'destroy']);
            Route::post('ocr/receipt', [OcrController::class, 'receipt']);
        });
        Route::middleware('org:bills.write')->group(function () {
            Route::post('bills', [BillController::class, 'store']);
            Route::patch('bills/{bill}', [BillController::class, 'update']);
            Route::delete('bills/{bill}', [BillController::class, 'destroy']);
            Route::post('bills/{bill}/pay', [BillController::class, 'pay']);
        });
        Route::middleware('org:transactions.view')->group(function () { // any member links their own phone
            Route::get('whatsapp', [WhatsAppController::class, 'show']);
            Route::post('whatsapp/all-in/start', [WhatsAppController::class, 'allInStart']);
        });
        Route::middleware('org:whatsapp.manage')->group(function () {
            Route::post('whatsapp/byon/start', [WhatsAppController::class, 'byonStart']);
            Route::post('whatsapp/byon/verify', [WhatsAppController::class, 'byonVerify']);
            Route::post('whatsapp/disconnect', [WhatsAppController::class, 'disconnect']);
            Route::post('whatsapp/test', [WhatsAppController::class, 'test']);
        });
        Route::middleware('org:billing.manage')->group(function () {
            Route::get('subscription', [SubscriptionController::class, 'show']);
            Route::post('subscription/checkout', [SubscriptionController::class, 'checkout']);
            Route::post('subscription/portal', [SubscriptionController::class, 'portal']);
            Route::post('subscription/cancel', [SubscriptionController::class, 'cancel']);
        });
        Route::middleware('org:transactions.view,pro')->group(function () {
            Route::get('api-tokens', [ApiTokenController::class, 'index']);
            Route::post('api-tokens', [ApiTokenController::class, 'store']);
            Route::delete('api-tokens/{id}', [ApiTokenController::class, 'destroy']);
        });
    });
});
