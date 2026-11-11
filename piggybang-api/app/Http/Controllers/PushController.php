<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\Request;

class PushController extends Controller
{
    /** The server later POSTs to `endpoint`, so only real browser push services are accepted (no SSRF). */
    private const HOSTS = '#^https://([a-z0-9-]+\.)*(googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/#i';

    public function key()
    {
        return ['key' => config('services.webpush.public_key')];
    }

    public function subscribe(Request $request)
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:1000', 'regex:'.self::HOSTS],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
        ]);
        // A device belongs to whoever enabled it last.
        PushSubscription::updateOrCreate(['endpoint' => $data['endpoint']], ['user_id' => $request->user()->id] + $data['keys']);

        return response()->noContent();
    }

    public function unsubscribe(Request $request)
    {
        $request->user()->pushSubscriptions()->where('endpoint', $request->input('endpoint'))->delete();

        return response()->noContent();
    }
}
