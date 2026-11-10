<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryResource;
use App\Models\Organization;
use App\Models\TransactionCategory;
use App\Services\OrganizationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request, Organization $org)
    {
        $type = $request->validate(['type' => 'nullable|in:income,expense'])['type'] ?? null;

        return CategoryResource::collection($org->categories()->withCount('transactions')
            ->when($type, fn ($q) => $q->where('type', $type))->orderBy('type')->orderBy('sort_order')->orderBy('id')->get());
    }

    public function store(Request $request, Organization $org)
    {
        $data = $request->validate([
            'type' => 'required|in:income,expense',
            'name' => ['required', 'string', 'max:100', Rule::unique('transaction_categories')->where('organization_id', $org->id)->where('type', $request->input('type'))],
            'icon' => 'nullable|string|max:50',
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);
        OrganizationService::assertCategoryAvailable($org, $data['type']);
        $cat = $org->categories()->create($data + ['sort_order' => (int) $org->categories()->where('type', $data['type'])->max('sort_order') + 1]);

        return (new CategoryResource($cat))->response()->setStatusCode(201);
    }

    public function update(Request $request, Organization $org, TransactionCategory $category)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100', Rule::unique('transaction_categories')->where('organization_id', $org->id)->where('type', $category->type)->ignore($category->id)],
            'icon' => 'sometimes|nullable|string|max:50',
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);
        $category->update($data);

        return new CategoryResource($category);
    }

    public function destroy(Request $request, Organization $org, TransactionCategory $category)
    {
        if ($category->is_system) {
            return response()->json(['message' => 'Kategori sistem tidak bisa dihapus.', 'code' => 'system_category'], 422);
        }
        $count = $category->transactions()->withTrashed()->count();
        $moveTo = $request->query('move_to');
        if ($count && ! $moveTo) {
            return response()->json(['message' => "Kategori ini punya {$count} transaksi. Pindahkan dulu.", 'code' => 'has_transactions', 'transactions_count' => $count], 422);
        }
        DB::transaction(function () use ($org, $category, $moveTo) {
            if ($moveTo) {
                $target = $org->categories()->where('type', $category->type)->whereKeyNot($category->id)->findOrFail($moveTo);
                $category->transactions()->withTrashed()->update(['category_id' => $target->id]);
                $org->rules()->where('category_id', $category->id)->update(['category_id' => $target->id]);
                $org->bills()->where('category_id', $category->id)->update(['category_id' => $target->id]);
            }
            $category->delete();
        });

        return response()->noContent();
    }

    public function reorder(Request $request, Organization $org)
    {
        $ids = $request->validate(['ids' => 'required|array', 'ids.*' => 'integer'])['ids'];
        DB::transaction(function () use ($org, $ids) {
            foreach ($ids as $i => $id) {
                $org->categories()->whereKey($id)->update(['sort_order' => $i]);
            }
        });

        return response()->noContent();
    }
}
