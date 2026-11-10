<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;

/** Receipt OCR: local Tesseract first (free), AI vision fallback for hard receipts. */
class OcrService
{
    public static function extract(string $imagePath, string $mime): array
    {
        $text = self::tesseract($imagePath);
        if ($text !== null) {
            $amount = self::extractAmount($text);
            $merchant = self::extractMerchant($text);
            if ($amount && $merchant) {
                return ['amount' => $amount, 'description' => $merchant, 'date' => self::extractDate($text), 'source' => 'tesseract'];
            }
        }
        if (! AiClient::configured()) {
            return ['amount' => self::extractAmount($text ?? ''), 'description' => self::extractMerchant($text ?? ''), 'date' => null, 'source' => 'tesseract'];
        }
        $r = AiClient::json([
            ['role' => 'system', 'content' => 'You read Indonesian receipts. Reply JSON {"amount": number (grand total in IDR, no separators), "description": string (merchant name), "date": "YYYY-MM-DD"|null}.'],
            ['role' => 'user', 'content' => [
                ['type' => 'text', 'text' => 'Extract total amount, merchant and date from this receipt.'],
                ['type' => 'image_url', 'image_url' => ['url' => 'data:'.$mime.';base64,'.base64_encode(file_get_contents($imagePath))]],
            ]],
        ], config('services.ai.vision_model'));

        return ['amount' => isset($r['amount']) ? (float) $r['amount'] : null, 'description' => $r['description'] ?? null, 'date' => $r['date'] ?? null, 'source' => 'ai'];
    }

    private static function tesseract(string $path): ?string
    {
        $result = Process::timeout(30)->run(['tesseract', $path, 'stdout', '-l', 'ind+eng']);

        return $result->successful() ? $result->output() : null;
    }

    /** Prefer the number on a TOTAL line; Indonesian thousands use "." (25.000) */
    public static function extractAmount(string $text): ?float
    {
        // Only a trailing [.,]dd is decimals; every other separator is thousands (25.000 / 25,000 / 25.000,00).
        $parse = fn ($s) => preg_match('/^(.*)[.,](\d{2})$/', $s, $d)
            ? (float) (preg_replace('/\D/', '', $d[1]).'.'.$d[2])
            : (float) preg_replace('/\D/', '', $s);
        if (preg_match_all('/(?:grand\s*total|total\s*bayar|total|jumlah|tagihan)\D{0,15}([\d.,]{3,})/i', $text, $m)) {
            return $parse(end($m[1]));
        }
        if (preg_match_all('/(?:rp\.?\s*)([\d.,]{3,})/i', $text, $m)) {
            return max(array_map($parse, $m[1]));
        }

        return null;
    }

    public static function extractMerchant(string $text): ?string
    {
        foreach (preg_split('/\R/', $text) as $line) {
            $line = trim($line);
            if (mb_strlen($line) >= 3 && preg_match('/[A-Za-z]{3,}/', $line)) {
                return mb_substr($line, 0, 100);
            }
        }

        return null;
    }

    private static function extractDate(string $text): ?string
    {
        if (preg_match('/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/', $text, $m)) {
            $y = strlen($m[3]) === 2 ? '20'.$m[3] : $m[3];

            return checkdate((int) $m[2], (int) $m[1], (int) $y) ? sprintf('%04d-%02d-%02d', $y, $m[2], $m[1]) : null;
        }

        return null;
    }
}
