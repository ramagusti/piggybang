<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user' => $this->user ? $this->user->only(['id', 'name', 'email', 'avatar_url']) : null,
            'email' => $this->user?->email ?? $this->email,
            'role' => $this->role,
            'pending' => $this->user_id === null,
            'joined_at' => $this->joined_at?->toIso8601String(),
            'invitation_accepted_at' => $this->invitation_accepted_at?->toIso8601String(),
        ];
    }
}
