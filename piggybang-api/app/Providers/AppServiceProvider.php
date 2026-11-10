<?php

namespace App\Providers;

use App\Models\ExchangeRate;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\PersonalAccessToken;
use App\Models\Transaction;
use App\Models\UserRule;
use App\Support\Memo;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(Memo::class);
    }

    public function boot(): void
    {
        JsonResource::withoutWrapping(); // contract: bare objects/arrays; paginated lists keep {data, meta}
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(60)->by($r->user()?->id ?: $r->ip()));
        RateLimiter::for('auth', fn (Request $r) => Limit::perMinute(5)->by($r->ip()));
        RateLimiter::for('ingest', fn (Request $r) => Limit::perMinute(30)->by('org:'.$r->header('X-Organization-ID', $r->ip())));

        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // Memoized reads (payday cycle, budget spend, rates, memberships) are dropped on any write to their sources.
        foreach ([Transaction::class, UserRule::class, Organization::class, Membership::class, ExchangeRate::class] as $model) {
            $model::saved(fn () => Memo::flush());
            $model::deleted(fn () => Memo::flush());
        }

        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim(config('app.frontend_url'), '/')
            .'/reset-password?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset()));
    }
}
