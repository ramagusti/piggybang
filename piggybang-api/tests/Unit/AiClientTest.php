<?php

namespace Tests\Unit;

use App\Services\AiClient;
use PHPUnit\Framework\TestCase;

class AiClientTest extends TestCase
{
    public function test_decodes_gateway_quirks(): void
    {
        $wrap = fn (string $content) => json_encode(['choices' => [['message' => ['content' => $content]]]]);

        $this->assertSame(['ok' => true], AiClient::decode($wrap('{"ok":true}')."data: [DONE]\n\n")); // 9Router trailer
        $this->assertSame(['ok' => true], AiClient::decode($wrap("```json\n{\"ok\":true}\n```"))); // fenced content
        $this->assertSame([], AiClient::decode('not json'));
    }
}
