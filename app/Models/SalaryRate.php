<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalaryRate extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['rate_cents' => 'integer'];
    }
}
