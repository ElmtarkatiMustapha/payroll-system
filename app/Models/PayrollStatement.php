<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollStatement extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'total_cents' => 'integer'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
