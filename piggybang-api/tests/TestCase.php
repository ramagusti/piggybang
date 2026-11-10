<?php

namespace Tests;

use App\Models\Organization;
use App\Models\User;
use App\Services\OrganizationService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Runs before RefreshDatabase wipes every table: refuse unless it's the in-memory test DB. */
    protected function setUpTraits()
    {
        $db = config('database.connections.'.config('database.default'));
        if (config('database.default') !== 'sqlite' || $db['database'] !== ':memory:') {
            throw new \RuntimeException('Refusing to run tests against a real database ('.config('database.default').'). Run `php artisan config:clear`.');
        }

        return parent::setUpTraits();
    }

    /** Owner + org. $plan: 'trial' (default, Pro features), 'free' (trial over), 'pro' (paid). */
    protected function makeOrg(string $plan = 'trial', ?User $owner = null): array
    {
        $owner ??= User::factory()->create();
        $org = OrganizationService::create($owner, 'Keluarga '.$owner->name);
        if ($plan !== 'trial') {
            $org->update(['trial_ends_at' => now()->subDay(), 'plan' => $plan === 'pro' ? 'pro' : 'free', 'member_limit' => $plan === 'pro' ? 5 : 2]);
        }

        return [$owner, $org->fresh()];
    }

    protected function cat(Organization $org, string $name, string $type = 'expense')
    {
        return $org->categories()->where(['name' => $name, 'type' => $type])->firstOrFail();
    }
}
