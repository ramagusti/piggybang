<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\WhatsAppSender;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WhatsAppController extends Controller
{
    public function show(Organization $org)
    {
        $c = $org->whatsappConnection;

        return [
            'connection' => $c ? [
                'mode' => $c->mode, 'phone_number' => $c->phone_number, 'status' => $c->status,
                'connected_at' => $c->connected_at?->toIso8601String(), 'monthly_conversations' => $c->monthly_conversations,
                'conversation_limit' => $org->botQuota(), // bot text replies per month on this plan (reactions are free)
                'linked_senders' => WhatsAppSender::where('organization_id', $org->id)->pluck('phone'),
            ] : null,
            'platform_number' => config('services.meta.platform_phone'),
            'subscribed_mode' => $org->isPro() ? 'all_in' : null,
        ];
    }

    public function byonStart(Request $request, Organization $org)
    {
        $this->requireMode($org, 'byon');
        $data = $request->validate(['phone_number' => ['required', 'regex:/^\+\d{8,15}$/'], 'country_code' => 'nullable|digits_between:1,3']);
        WhatsAppService::startByon($org, $data['phone_number'], $data['country_code'] ?? '62');

        return $this->show($org->fresh());
    }

    public function byonVerify(Request $request, Organization $org)
    {
        $this->requireMode($org, 'byon');
        $code = $request->validate(['code' => 'required|digits_between:4,8'])['code'];
        $conn = $org->whatsappConnection;
        abort_unless($conn && $conn->mode === 'byon' && $conn->status === 'verifying', 422, 'Mulai pendaftaran nomor dulu.');
        WhatsAppService::verifyByon($conn, $code);

        return $this->show($org->fresh());
    }

    public function allInStart(Request $request, Organization $org)
    {
        $this->requireMode($org, 'all_in');

        return WhatsAppService::startAllIn($org->load('whatsappConnection'), $request->user());
    }

    public function disconnect(Organization $org)
    {
        $conn = $org->whatsappConnection;
        if ($conn?->mode === 'byon' && $conn->phone_number_id && $conn->status === 'connected') {
            Http::baseUrl('https://graph.facebook.com/'.config('services.meta.graph_version'))
                ->withToken(WhatsAppService::tokenFor($conn))->post($conn->phone_number_id.'/deregister'); // best effort
        }
        WhatsAppSender::where('organization_id', $org->id)->delete();
        $conn?->delete();

        return response()->noContent();
    }

    public function test(Organization $org)
    {
        $conn = $org->whatsappConnection;
        abort_unless($conn?->status === 'connected', 422, 'WhatsApp belum terhubung.');
        // Meta only allows free-form messages within 24h of the user's last message.
        $senders = WhatsAppSender::where('organization_id', $org->id)->where('last_message_at', '>', now()->subDay())->get();
        abort_if($senders->isEmpty(), 422, 'Kirim pesan apa saja ke nomor bot dari WhatsApp kamu dulu (aturan 24 jam Meta), lalu coba lagi.');
        foreach ($senders as $s) {
            WhatsAppService::sendText($conn->phone_number_id, $s->phone, '🎉 Piggybang terhubung! Ini pesan uji coba.', WhatsAppService::tokenFor($conn));
        }

        return ['message' => 'Pesan uji coba terkirim ke '.$senders->count().' nomor.'];
    }

    private function requireMode(Organization $org, string $mode): void
    {
        // WhatsApp comes with Pro (incl. trial) on the shared Piggybang number. BYON is retired.
        abort_if($mode === 'byon', 410, 'Nomor sendiri (BYON) tidak tersedia lagi. Pakai nomor Piggybang.');
        if (! $org->isPro()) {
            abort(response()->json(['message' => 'WhatsApp tersedia di paket Pro. Upgrade di Penagihan.', 'code' => 'whatsapp_subscription_required'], 403));
        }
    }
}
