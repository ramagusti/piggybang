<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessWhatsAppMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** Meta webhook for the platform app (covers BYON numbers on the platform WABA and the All-In number). */
class WhatsAppWebhookController extends Controller
{
    public function verify(Request $request)
    {
        abort_unless($request->query('hub_mode') === 'subscribe'
            && hash_equals((string) config('services.meta.verify_token'), (string) $request->query('hub_verify_token')), 403);

        return response((string) $request->query('hub_challenge'), 200, ['Content-Type' => 'text/plain']);
    }

    public function receive(Request $request)
    {
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), (string) config('services.meta.app_secret'));
        abort_unless(config('services.meta.app_secret') && hash_equals($expected, (string) $request->header('X-Hub-Signature-256')), 401);

        foreach ($request->input('entry', []) as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];
                $names = collect($value['contacts'] ?? [])->mapWithKeys(fn ($c) => [$c['wa_id'] => $c['profile']['name'] ?? null]);
                foreach ($value['messages'] ?? [] as $msg) {
                    if (! Cache::add('wa-msg:'.$msg['id'], 1, now()->addDay())) {
                        continue; // Meta retries → dedupe
                    }
                    ProcessWhatsAppMessage::dispatch([
                        'id' => (string) $msg['id'],
                        'phone_number_id' => (string) ($value['metadata']['phone_number_id'] ?? ''),
                        'from' => (string) $msg['from'],
                        'name' => $names[$msg['from']] ?? null,
                        'type' => $msg['type'] ?? 'text',
                        'text' => $msg['text']['body'] ?? $msg['image']['caption'] ?? null,
                        'media_id' => $msg['image']['id'] ?? null,
                    ]);
                }
            }
        }

        return response()->json(['ok' => true]);
    }
}
