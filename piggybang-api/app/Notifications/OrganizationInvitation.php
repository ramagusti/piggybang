<?php

namespace App\Notifications;

use App\Models\Membership;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrganizationInvitation extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Membership $membership, public string $inviterName) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $org = $this->membership->organization;

        return (new MailMessage)
            ->subject("Undangan bergabung ke {$org->name} di PiggyBang!")
            ->line("{$this->inviterName} mengundang kamu ke {$org->name}.")
            ->action('Gabung sekarang', rtrim(config('app.frontend_url'), '/').'/join/'.$this->membership->invitation_token)
            ->line('Belum punya akun? Kamu bisa daftar langsung dari link itu.');
    }
}
