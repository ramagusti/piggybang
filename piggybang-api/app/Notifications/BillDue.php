<?php

namespace App\Notifications;

use App\Models\Bill;
use App\Services\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BillDue extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Bill $bill) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $d = $this->bill->daysUntilDue();

        return (new MailMessage)
            ->subject("Tagihan {$this->bill->name} ".($d <= 0 ? 'jatuh tempo' : "$d hari lagi"))
            ->line("{$this->bill->name}: ".WhatsAppService::rupiah($this->bill->amount).' — jatuh tempo '.$this->bill->due_date->format('d M Y').'.')
            ->line($this->bill->destination_account ? "Tujuan: {$this->bill->destination_account} {$this->bill->destination_number}" : '')
            ->action('Lihat tagihan', rtrim(config('app.frontend_url'), '/').'/app/bills');
    }
}
