<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }

    public function salaryRates(): HasMany
    {
        return $this->hasMany(SalaryRate::class)->orderBy('effective_date');
    }

    public function advances(): HasMany
    {
        return $this->hasMany(Advance::class)->orderByDesc('date')->orderByDesc('id');
    }

    public function absences(): HasMany
    {
        return $this->hasMany(Absence::class)->orderByDesc('date');
    }

    public function statements(): HasMany
    {
        return $this->hasMany(PayrollStatement::class)->orderByDesc('from');
    }
}
