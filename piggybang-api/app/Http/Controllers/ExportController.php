<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Services\SavingsService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class ExportController extends Controller
{
    public function transactions(Request $request, Organization $org)
    {
        $f = $request->validate(['format' => 'nullable|in:csv,pdf', 'from' => 'nullable|date', 'to' => 'nullable|date', 'type' => 'nullable|in:income,expense', 'category_id' => 'nullable|integer']);
        $tz = $org->timezone();
        $rows = TransactionController::filtered($org, $f)->with('category')->orderBy('transaction_time')->get()
            ->map(fn ($t) => [
                $t->transaction_time->setTimezone($tz)->format('Y-m-d H:i'), $t->type, $t->category?->name, $t->amount,
                $t->currency, $t->description, $t->actor, $t->source,
            ]);
        $headers = ['date', 'type', 'category', 'amount', 'currency', 'description', 'actor', 'source'];
        $range = trim(($f['from'] ?? '').' – '.($f['to'] ?? ''), ' –');

        return $this->respond($f['format'] ?? 'csv', "transactions-{$org->slug}", 'Transaksi '.$org->name, $range ?: 'Semua periode', $headers, $rows->all(), [3]);
    }

    public function savings(Request $request, Organization $org)
    {
        $format = $request->validate(['format' => 'nullable|in:csv,pdf'])['format'] ?? 'csv';
        SavingsService::recordForOrganization($org);
        $rows = $org->savings()->orderByDesc('cycle_start')->get()
            ->map(fn ($s) => array_values(SavingsService::present($s)));

        return $this->respond($format, "savings-{$org->slug}", 'Tabungan '.$org->name, 'Per siklus gajian', ['cycle_start', 'cycle_end', 'income', 'expense', 'net'], $rows->all(), [2, 3, 4]);
    }

    private function respond(string $format, string $name, string $title, string $subtitle, array $headers, array $rows, array $numeric)
    {
        if ($format === 'pdf') {
            return Pdf::loadView('exports.table', compact('title', 'subtitle', 'headers', 'rows', 'numeric'))
                ->setPaper('a4', 'landscape')->download("$name.pdf");
        }

        return response()->streamDownload(function () use ($headers, $rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $headers);
            foreach ($rows as $r) {
                // Neutralise spreadsheet formula injection in user-supplied text.
                fputcsv($out, array_map(fn ($v) => is_string($v) && preg_match('/^[=+\-@\t\r]/', $v) && ! is_numeric($v) ? "'".$v : $v, $r));
            }
            fclose($out);
        }, "$name.csv", ['Content-Type' => 'text/csv']);
    }
}
