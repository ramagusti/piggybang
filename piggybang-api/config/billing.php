<?php

// Per team. Free: 2 members, no WhatsApp. Paid tiers share every Pro feature and differ only in how many
// WhatsApp text replies the bot may send per month (reactions are free and unlimited). Meta charges about
// Rp 396 incl. VAT per text (2026-10 rate card), so each tier keeps text cost well under its price.
// Monthly carries Xendit's per-invoice fees (~Rp 4.800-5.800 each via QRIS/e-wallet), so it's priced 10% higher;
// yearly stays at 10 × the old monthly (~24% cheaper) to push one fee per year. USD only used if Stripe is ever enabled.
return [
    'tiers' => [
        'pro' => ['name' => 'Pro', 'bot_replies' => 50],
        'plus' => ['name' => 'Plus', 'bot_replies' => 150],
        'max' => ['name' => 'Max', 'bot_replies' => 350],
    ],
    'bot_replies_per_seat' => 10,
    // Add-on: extra bot replies on top of any tier (Rp 600/reply vs ~Rp 396 Meta cost).
    'bot_pack' => ['replies' => 50],
    // Mid-period add-on increases are charged pro rata. Below this amount they apply at once and the charge rides on
    // the next renewal invoice (a separate invoice would lose ~Rp 4.500+ to Xendit fees); at/above it, invoice now.
    'addon_invoice_min' => 25000,
    'trial_bot_replies' => 20,
    'prices' => [
        'IDR' => [
            'pro_monthly' => 55000, 'pro_yearly' => 500000,
            'plus_monthly' => 110000, 'plus_yearly' => 1000000,
            'max_monthly' => 220000, 'max_yearly' => 2000000,
            'seat_monthly' => 15000, 'seat_yearly' => 150000,
            'pack_monthly' => 30000, 'pack_yearly' => 300000,
        ],
        'USD' => [
            'pro_monthly' => 3.5, 'pro_yearly' => 35, 'plus_monthly' => 7, 'plus_yearly' => 70,
            'max_monthly' => 14, 'max_yearly' => 140, 'seat_monthly' => 1, 'seat_yearly' => 10,
            'pack_monthly' => 2, 'pack_yearly' => 20,
        ],
    ],
    'past_due_grace_days' => 7,
];
