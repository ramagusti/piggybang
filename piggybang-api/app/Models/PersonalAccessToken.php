<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumToken;

class PersonalAccessToken extends SanctumToken
{
    /** Sanctum writes last_used_at on every request; one write per 5 minutes is plenty. */
    public function save(array $options = []): bool
    {
        if (array_keys($this->getDirty()) === ['last_used_at'] && $this->getOriginal('last_used_at')?->gt(now()->subMinutes(5))) {
            return true;
        }

        return parent::save($options);
    }
}
