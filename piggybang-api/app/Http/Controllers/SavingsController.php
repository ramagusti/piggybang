<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Services\SavingsService;

class SavingsController extends Controller
{
    public function current(Organization $org)
    {
        return SavingsService::current($org);
    }

    public function history(Organization $org)
    {
        // Current cycle's row is kept fresh by transaction writes and GET /savings.
        return $org->savings()->orderByDesc('cycle_start')->limit(36)->get()->map(fn ($s) => SavingsService::present($s));
    }
}
