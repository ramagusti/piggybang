<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/** OpenAI-compatible chat client (9Router gateway → GPT-4o-mini by default). */
class AiClient
{
    public static function configured(): bool
    {
        return (bool) config('services.ai.key');
    }

    /** @param array $messages OpenAI chat messages. Returns decoded JSON object from the model. */
    public static function json(array $messages, ?string $model = null, int $timeout = 25): array
    {
        // 25s: a WhatsApp user is waiting; the queue job retries once on timeout.
        $res = Http::withToken(config('services.ai.key'))->timeout($timeout)
            ->post(rtrim(config('services.ai.base_url'), '/').'/chat/completions', [
                'model' => $model ?? config('services.ai.model'),
                'messages' => $messages,
                'response_format' => ['type' => 'json_object'],
                'temperature' => 0,
            ])->throw();

        return self::decode($res->body());
    }

    /** Tolerates gateway quirks: a trailing SSE "data: [DONE]" after the JSON body, and ```json fences in the content. */
    public static function decode(string $body): array
    {
        $body = preg_replace('/(\s*data:\s*\[DONE\]\s*)+$/', '', $body);
        $content = (string) data_get(json_decode($body, true), 'choices.0.message.content', '');
        $content = preg_replace('/^\s*```(?:json)?\s*|\s*```\s*$/', '', $content);

        return json_decode($content, true) ?: [];
    }
}
