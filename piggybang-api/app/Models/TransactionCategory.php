<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TransactionCategory extends Model
{
    protected $guarded = [];

    protected $casts = ['is_system' => 'boolean'];

    public const DEFAULTS = [
        'expense' => [
            ['Food & Beverages', '🍜', '#F97316'], ['Transportation', '🚗', '#3B82F6'], ["Kid's Stuff", '🧸', '#F59E0B'],
            ['Bills & Subscriptions', '🧾', '#8B5CF6'], ['Health, Selfcare & Beauty', '💄', '#EC4899'],
            ['Apparels & Wearables', '👕', '#14B8A6'], ['Other', '📦', '#9CA3AF'],
        ],
        'income' => [
            ['Salary', '💰', '#10B981'], ['Bonus', '🎁', '#22C55E'], ['Other Income', '📦', '#9CA3AF'],
        ],
    ];

    /** Emoji guess from a category name (first keyword hit wins), for categories created without one. */
    private const EMOJI = [
        'food' => '🍜', 'makan' => '🍜', 'grocer' => '🛒', 'belanja' => '🛒', 'housing' => '🏠', 'rumah' => '🏠', 'bill' => '🧾',
        'laundry' => '🧺', 'travel' => '✈️', 'transport' => '🚗', 'beauty' => '💄', 'selfcare' => '💄', 'health' => '🩺',
        'apparel' => '👕', 'gift' => '🎁', 'bonus' => '🎁', 'gadget' => '📱', 'hobby' => '🎮', 'entertainment' => '🎮',
        'investment' => '📈', 'education' => '📚', 'salary' => '💰', 'gaji' => '💰', 'work' => '💼', 'transfer' => '🔁',
        'pregnan' => '🤰', 'kid' => '🧸', 'anak' => '🧸', 'donation' => '🤲',
    ];

    public static function emojiFor(string $name): string
    {
        $name = mb_strtolower($name);
        foreach (self::EMOJI as $k => $e) {
            if (str_contains($name, $k)) {
                return $e;
            }
        }

        return '📦';
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'category_id');
    }
}
