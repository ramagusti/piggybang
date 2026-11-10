<?php

namespace Tests\Unit;

use App\Services\OcrService;
use PHPUnit\Framework\TestCase;

class OcrParsingTest extends TestCase
{
    public function test_amount_parsing_handles_indonesian_and_english_separators(): void
    {
        $this->assertSame(25000.0, OcrService::extractAmount("MIXUE\nTOTAL Rp 25.000"));
        $this->assertSame(25000.0, OcrService::extractAmount('Grand Total: 25,000'));
        $this->assertSame(125000.5, OcrService::extractAmount('Total 125.000,50'));
        $this->assertSame(32000.0, OcrService::extractAmount("subtotal 30.000\nTOTAL 32.000"));
        $this->assertNull(OcrService::extractAmount('no numbers here'));
    }
}
