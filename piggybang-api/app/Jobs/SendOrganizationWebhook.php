<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Support\SafeUrl;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;

/** Outgoing webhook (Pro). Body signed: X-Piggybang-Signature = hex(hmac_sha256(body, settings.webhook_secret)). */
class SendOrganizationWebhook implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public array $backoff = [10, 60, 300, 900];

    public function __construct(public int $organizationId, public string $event, public array $data) {}

    public function handle(): void
    {
        $org = Organization::find($this->organizationId);
        $url = $org?->settings['webhook_url'] ?? null;
        if (! $url || ! SafeUrl::isPublicHttps($url)) {
            return;
        }
        $body = json_encode(['event' => $this->event, 'organization_id' => $org->id, 'data' => $this->data, 'sent_at' => now()->toIso8601String()]);
        Http::timeout(10)->withBody($body, 'application/json')
            ->withHeaders(['X-Piggybang-Signature' => hash_hmac('sha256', $body, $org->settings['webhook_secret'] ?? '')])
            ->post($url)->throw();
    }
}
