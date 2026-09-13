<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Absence extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['is_paid' => 'boolean', 'days' => 'float'];
    }
}
