<?php

namespace App\Services;

use App\Models\Employee;
use Illuminate\Validation\ValidationException;

class PayrollGuard
{
    public static function dateIsEditable(Employee $employee, string $date): void
    {
        if ($employee->statements()->where('from', '<=', $date)->where('to', '>=', $date)->exists()) {
            throw ValidationException::withMessages(['date' => __('messages.period_locked')]);
        }
    }

    public static function employmentDate(Employee $employee, string $date): void
    {
        if ($date < $employee->start_date || ($employee->end_date && $date > $employee->end_date)) {
            throw ValidationException::withMessages(['date' => __('messages.outside_employment')]);
        }
    }

    public static function salaryIsEditable(Employee $employee, string $date): void
    {
        if ($employee->statements()->where('to', '>=', $date)->exists()) {
            throw ValidationException::withMessages(['effective_date' => __('messages.period_locked')]);
        }
    }
}
