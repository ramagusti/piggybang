<?php

namespace App\Http\Controllers;

use App\Services\BillingService;
use Illuminate\Http\Request;

class BillingWebhookController extends Controller
{
    public function stripe(Request $request)
    {
        abort_unless(BillingService::verifyStripeSignature($request->getContent(), (string) $request->header('Stripe-Signature')), 400, 'Invalid signature');
        BillingService::handleStripeEvent(json_decode($request->getContent(), true));

        return ['received' => true];
    }

    public function xendit(Request $request)
    {
        $token = (string) config('services.xendit.callback_token');
        abort_unless($token !== '' && hash_equals($token, (string) $request->header('x-callback-token')), 401);
        BillingService::handleXenditCallback($request->all());

        return ['received' => true];
    }
}
