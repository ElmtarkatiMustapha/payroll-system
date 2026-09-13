<?php

namespace App\Models;

use Carbon\CarbonImmutable;
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

    public function employmentPeriods(): HasMany
    {
        return $this->hasMany(EmploymentPeriod::class)->orderBy('start_date');
    }

    public function isEmployedOn(string $date): bool
    {
        $this->loadMissing('employmentPeriods');

        return $this->employmentPeriods->contains(fn ($period) => $period->start_date <= $date
            && (! $period->end_date || $period->end_date >= $date));
    }

    public function coversEmploymentRange(string $from, string $to): bool
    {
        $this->loadMissing('employmentPeriods');
        $cursor = $from;
        foreach ($this->employmentPeriods as $period) {
            if ($period->end_date && $period->end_date < $cursor) {
                continue;
            }
            if ($period->start_date > $cursor) {
                return false;
            }
            if (! $period->end_date || $period->end_date >= $to) {
                return true;
            }
            $cursor = CarbonImmutable::parse($period->end_date)->addDay()->toDateString();
        }

        return false;
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
