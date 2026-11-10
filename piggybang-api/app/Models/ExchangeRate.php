<?php

namespace App\Models;

use App\Support\Memo;
use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['fetched_at' => 'datetime'];

    /** Rate to convert $from into $to; 1.0 when same or unknown (ponytail: manual rates, live API in v2). */
    public static function rate(string $from, string $to): float
    {
        if ($from === $to) {
            return 1.0;
        }

        return Memo::get("rate:$from:$to", fn () => static::lookup($from, $to));
    }

    private static function lookup(string $from, string $to): float
    {
        $direct = static::where(['from_currency' => $from, 'to_currency' => $to])->value('rate');
        if ($direct) {
            return (float) $direct;
        }
        $inverse = static::where(['from_currency' => $to, 'to_currency' => $from])->value('rate');

        return $inverse ? 1 / (float) $inverse : 1.0;
    }
}
