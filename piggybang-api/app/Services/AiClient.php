<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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
                'max_tokens' => 4096, // explicit: gateway defaults can cut a long JSON answer mid-way
            ])->throw();

        $out = self::decode($res->body());
        if (! $out) {
            Log::warning('AiClient: unreadable answer', ['finish_reason' => $res->json('choices.0.finish_reason'), 'body' => Str::limit($res->body(), 3000)]);
        }

        return $out;
    }

    /**
     * Tolerates gateway/model quirks: a trailing SSE "data: [DONE]" after the JSON body, ```json fences,
     * and prose around the JSON (takes the outermost {...}).
     */
    public static function decode(string $body): array
    {
        $body = preg_replace('/(\s*data:\s*\[DONE\]\s*)+$/', '', $body);
        $content = (string) data_get(json_decode($body, true), 'choices.0.message.content', '');
        $content = preg_replace('/^\s*```(?:json)?\s*|\s*```\s*$/', '', $content);
        $json = json_decode($content, true);
        if (! is_array($json) && ($from = strpos($content, '{')) !== false && ($to = strrpos($content, '}')) > $from) {
            $json = json_decode(substr($content, $from, $to - $from + 1), true);
        }

        return is_array($json) ? $json : [];
    }
}
