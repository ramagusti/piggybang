<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Jobs\AssignBudget;
use App\Models\Organization;
use App\Models\Transaction;
use App\Services\OrganizationService;
use App\Services\TransactionService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function index(Request $request, Organization $org)
    {
        $f = $request->validate([
            'type' => 'nullable|in:income,expense', 'category_id' => 'nullable|integer', 'user_id' => 'nullable|integer',
            'q' => 'nullable|string|max:100', 'from' => 'nullable|date', 'to' => 'nullable|date', 'per_page' => 'nullable|integer|between:1,100',
        ]);

        return TransactionResource::collection(self::filtered($org, $f)->with('category', 'user')
            ->orderByDesc('transaction_time')->orderByDesc('id')->paginate($f['per_page'] ?? 20));
    }

    /** Shared by index + export. Dates are interpreted in the org timezone. */
    public static function filtered(Organization $org, array $f)
    {
        $tz = $org->timezone();

        return $org->transactions()
            ->when($f['type'] ?? null, fn ($q, $v) => $q->where('transactions.type', $v))
            ->when($f['category_id'] ?? null, fn ($q, $v) => $q->where('category_id', $v))
            ->when($f['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->whereRaw('LOWER(description) LIKE ?', ['%'.mb_strtolower($v).'%'])
                ->orWhereRaw('LOWER(actor) LIKE ?', ['%'.mb_strtolower($v).'%'])))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where('transaction_time', '>=', Carbon::parse($v, $tz)->startOfDay()->utc()))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where('transaction_time', '<=', Carbon::parse($v, $tz)->endOfDay()->utc()));
    }

    public function store(Request $request, Organization $org)
    {
        $data = $this->validated($request, $org);
        $tx = TransactionService::create($org, $data, $request->user(), $request->user()->currentAccessToken()?->name === 'web' ? 'web' : 'api');
        AssignBudget::dispatch($org->id, [$tx->id]);

        return response()->json(['transaction' => new TransactionResource($tx), 'metadata' => TransactionService::afterWrite($org)], 201);
    }

    /**
     * Split bill: one payment divided into parts (each its own category and/or person). Saved atomically;
     * the parts must add up to the total. Each transaction keeps metadata.split {group, part, of, total}.
     */
    public function split(Request $request, Organization $org)
    {
        $request->validate([
            'splits' => 'required|array|min:2|max:20',
            'splits.*.amount' => 'required|numeric|gt:0|max:999999999999999',
            'splits.*.category_id' => ['required', Rule::exists('transaction_categories', 'id')->where('organization_id', $org->id)->where('type', $request->input('type'))],
            'splits.*.actor' => 'nullable|string|max:100',
        ]);
        $base = $this->validated($request->merge(['category_id' => $request->input('splits.0.category_id')]), $org);
        $parts = collect($request->input('splits'));
        if (abs($parts->sum('amount') - (float) $base['amount']) >= 0.01) {
            throw ValidationException::withMessages(['splits' => ['Jumlah semua bagian harus sama dengan total.']]);
        }
        $group = (string) Str::uuid();
        $source = $request->user()->currentAccessToken()?->name === 'web' ? 'web' : 'api';
        $txs = DB::transaction(fn () => $parts->values()->map(fn ($p, $i) => TransactionService::create($org, [
            'category_id' => $p['category_id'], 'amount' => $p['amount'], 'actor' => ($p['actor'] ?? null) ?: ($base['actor'] ?? null),
            'metadata' => ['split' => ['group' => $group, 'part' => $i + 1, 'of' => $parts->count(), 'total' => (float) $base['amount']]],
        ] + $base, $request->user(), $source)));
        AssignBudget::dispatch($org->id, $txs->pluck('id')->all());

        return response()->json(['transactions' => TransactionResource::collection($txs), 'metadata' => TransactionService::afterWrite($org)], 201);
    }

    public function show(Organization $org, Transaction $transaction)
    {
        return new TransactionResource($transaction->load('category', 'user'));
    }

    public function update(Request $request, Organization $org, Transaction $transaction)
    {
        $transaction->update($this->validated($request, $org, true));
        if ($transaction->wasChanged(['category_id', 'description', 'type'])) {
            AssignBudget::dispatch($org->id, [$transaction->id]); // re-pick: also how a wrong AI pick gets corrected
        }
        TransactionService::fireWebhook($org, 'transaction.updated', $transaction);

        return ['transaction' => new TransactionResource($transaction->load('category', 'user')), 'metadata' => TransactionService::afterWrite($org)];
    }

    public function destroy(Organization $org, Transaction $transaction)
    {
        $transaction->delete();
        TransactionService::fireWebhook($org, 'transaction.deleted', $transaction);
        TransactionService::afterWrite($org);

        return response()->noContent();
    }

    public function import(Request $request, Organization $org)
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt|max:5120']);
        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = array_map(fn ($h) => strtolower(trim($h, " \t\n\r\0\x0B\xEF\xBB\xBF")), fgetcsv($handle) ?: []);
        $categories = $org->categories()->get();
        $imported = 0;
        $errors = [];
        $row = 1;

        DB::transaction(function () use ($handle, $header, $categories, $org, $request, &$imported, &$errors, &$row) {
            while (($cols = fgetcsv($handle)) !== false) {
                $row++;
                if (count(array_filter($cols, fn ($c) => trim((string) $c) !== '')) === 0) {
                    continue;
                }
                $r = array_combine($header, array_pad(array_slice($cols, 0, count($header)), count($header), null));
                $v = Validator::make($r, [
                    'date' => 'required|date', 'type' => 'required|in:income,expense', 'amount' => 'required|numeric|min:0',
                    'currency' => 'nullable|string|size:3', 'description' => 'nullable|string', 'actor' => 'nullable|string|max:100',
                ]);
                if ($v->fails()) {
                    $errors[] = ['row' => $row, 'message' => $v->errors()->first()];

                    continue;
                }
                $cat = $categories->first(fn ($c) => $c->type === $r['type'] && mb_strtolower($c->name) === mb_strtolower(trim((string) ($r['category'] ?? ''))))
                    ?? $categories->first(fn ($c) => $c->type === $r['type'] && $c->is_system);
                $org->transactions()->create([
                    'user_id' => $request->user()->id, 'category_id' => $cat?->id, 'type' => $r['type'], 'amount' => $r['amount'],
                    'currency' => strtoupper($r['currency'] ?: $org->currency()), 'description' => $r['description'] ?: null,
                    'actor' => $r['actor'] ?: $request->user()->name,
                    'transaction_time' => Carbon::parse($r['date'], $org->timezone())->utc(), 'source' => 'import',
                ]);
                $imported++;
            }
        });
        fclose($handle);
        TransactionService::afterWrite($org);
        if ($imported) {
            AssignBudget::forCycle($org);
        }

        return ['imported' => $imported, 'errors' => $errors];
    }

    private function validated(Request $request, Organization $org, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        $data = $request->validate([
            'type' => "$req|in:income,expense",
            'category_id' => [$req, 'nullable', Rule::exists('transaction_categories', 'id')->where('organization_id', $org->id)->where('type', $request->input('type', $request->route('transaction')?->type))],
            'amount' => "$req|numeric|min:0|max:999999999999999",
            'currency' => 'sometimes|string|size:3',
            'description' => 'nullable|string|max:2000',
            'actor' => 'nullable|string|max:100',
            'transaction_time' => "$req|date",
            'proof' => 'sometimes|image|max:5120',
        ]);
        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
            if ($data['currency'] !== $org->currency() && ! $org->isPro()) {
                throw OrganizationService::planLimit('Multi-mata uang hanya untuk Pro.');
            }
        }
        if (isset($data['transaction_time'])) {
            $data['transaction_time'] = Carbon::parse($data['transaction_time'], $org->timezone())->utc();
        }
        if ($request->hasFile('proof')) {
            $path = $request->file('proof')->store("receipts/{$org->id}", config('filesystems.receipts_disk'));
            $data['proof_url'] = Storage::disk(config('filesystems.receipts_disk'))->url($path);
        }
        unset($data['proof']);

        return $data;
    }
}
