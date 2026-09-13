<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['working_days' => 'array'];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], [
            'company_name' => 'SRT Payroll', 'currency' => 'MAD',
            'locale' => 'en', 'working_days' => [1, 2, 3, 4, 5, 6],
        ]);
    }
}
