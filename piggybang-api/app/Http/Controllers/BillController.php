<?php

namespace App\Http\Controllers;

use App\Http\Resources\BillResource;
use App\Http\Resources\TransactionResource;
use App\Jobs\AssignBudget;
use App\Models\Bill;
use App\Models\Organization;
use App\Services\TransactionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BillController extends Controller
{
    public function index(Organization $org)
    {
        return BillResource::collection($org->bills()->with(['category', 'creator'])->orderByDesc('is_active')->orderBy('due_date')->get());
    }

    public function store(Request $request, Organization $org)
    {
        $bill = $org->bills()->create($this->withCategory($this->validated($request, $org), $org) + ['created_by' => $request->user()->id]);

        return (new BillResource($bill))->response()->setStatusCode(201);
    }

    public function update(Request $request, Organization $org, Bill $bill)
    {
        $bill->update($this->withCategory($this->validated($request, $org, true), $org, $bill));

        return new BillResource($bill);
    }

    public function destroy(Organization $org, Bill $bill)
    {
        $bill->delete();

        return response()->noContent();
    }

    public function pay(Request $request, Organization $org, Bill $bill)
    {
        abort_unless($bill->is_active, 422, 'Tagihan sudah dibayar.');
        $bill->category_id ??= Bill::guessCategoryId($org, $bill->name); // bills saved before categories were guessed
        $tx = DB::transaction(function () use ($request, $org, $bill) {
            $tx = TransactionService::create($org, [
                'type' => 'expense', 'category_id' => $bill->category_id, 'amount' => $bill->amount, 'currency' => $bill->currency,
                'description' => $bill->name, 'transaction_time' => now(),
            ], $request->user());
            $next = $bill->nextDueDate();
            $bill->update(['last_paid_at' => now(), 'due_date' => $next ?? $bill->due_date, 'is_active' => (bool) $next, 'last_notified_at' => null]);

            return $tx;
        });
        TransactionService::afterWrite($org);
        AssignBudget::dispatch($org->id, [$tx->id]);

        return ['bill' => new BillResource($bill), 'transaction' => new TransactionResource($tx)];
    }

    /** No category chosen → guess it from the name. */
    private function withCategory(array $data, Organization $org, ?Bill $bill = null): array
    {
        if (empty($data['category_id']) && ! $bill?->category_id && ($name = $data['name'] ?? $bill?->name)) {
            $data['category_id'] = Bill::guessCategoryId($org, $name);
        }

        return $data;
    }

    private function validated(Request $request, Organization $org, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => "$req|string|max:100",
            'amount' => "$req|numeric|min:0",
            'currency' => 'sometimes|string|size:3',
            'due_date' => "$req|date",
            'recurrence' => 'nullable|in:monthly,quarterly,yearly,one_time',
            'category_id' => ['nullable', Rule::exists('transaction_categories', 'id')->where('organization_id', $org->id)->where('type', 'expense')],
            'destination_account' => 'nullable|string|max:100',
            'destination_number' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
        ]);
    }
}
