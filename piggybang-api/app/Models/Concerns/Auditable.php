<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;

/** Writes an audit_logs row for every create/update/delete of the model. */
trait Auditable
{
    protected static function bootAuditable(): void
    {
        foreach (['created', 'updated', 'deleted'] as $event) {
            static::$event(function ($model) use ($event) {
                $changes = $event === 'updated' ? $model->getChanges() : [];
                unset($changes['updated_at']);
                if ($event === 'updated' && ! $changes) {
                    return;
                }
                $request = app()->runningInConsole() ? null : request();
                AuditLog::create([
                    'organization_id' => $model->organization_id ?? null,
                    'user_id' => $request?->user()?->id,
                    'action' => class_basename($model).'.'.$event,
                    'auditable_type' => $model->getMorphClass(),
                    'auditable_id' => $model->getKey(),
                    'old_values' => $event === 'updated' ? array_intersect_key($model->getOriginal(), $changes) : ($event === 'deleted' ? $model->getAttributes() : null),
                    'new_values' => $event === 'deleted' ? null : ($event === 'updated' ? $changes : $model->getAttributes()),
                    'ip_address' => $request?->ip(),
                    'user_agent' => $request?->userAgent(),
                ]);
            });
        }
    }
}
