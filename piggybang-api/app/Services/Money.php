<?php

namespace App\Services;

use App\Models\ExchangeRate;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

class Money
{
    /** Sum `amount` of a transaction query in $currency, converting per-currency subtotals. */
    public static function sum(Builder|Relation $query, string $currency = 'IDR'): float
    {
        return (float) (clone $query)->reorder()->selectRaw('currency, SUM(amount) as total')->groupBy('currency')->get()
            ->sum(fn ($row) => (float) $row->total * ExchangeRate::rate($row->currency, $currency));
    }

    public static function fmt(float|string $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }
}
