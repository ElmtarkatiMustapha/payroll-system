<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

class PayrollCalculator
{
    public function calculate(Employee $employee, string $from, string $to): array
    {
        $employee->loadMissing(['salaryRates', 'advances', 'absences', 'statements']);
        $settings = Setting::current();
        $absences = $employee->absences->keyBy('date');
        $advances = $employee->advances->whereBetween('date', [$from, $to])->values();
        $advancesByDate = $advances->groupBy('date');
        $lockedDays = [];
        foreach ($employee->statements as $statement) {
            foreach ($statement->snapshot['daily_breakdown'] as $day) {
                $day['settled'] = $statement->status === 'paid';
                $lockedDays[$day['date']] = $day;
            }
        }

        $totals = ['scheduled_days' => 0, 'worked_days' => 0, 'absence_days' => 0, 'unpaid_absence_days' => 0,
            'base_cents' => 0, 'deduction_cents' => 0, 'advances_cents' => 0, 'remaining_cents' => 0, 'settled_cents' => 0];
        $daily = [];
        for ($date = CarbonImmutable::parse($from); $date->toDateString() <= $to; $date = $date->addDay()) {
            $key = $date->toDateString();
            if (isset($lockedDays[$key])) {
                $day = $lockedDays[$key];
            } else {
                $scheduled = $key >= $employee->start_date && (! $employee->end_date || $key <= $employee->end_date)
                    && in_array($date->dayOfWeekIso, $settings->working_days, true);
                $rate = $employee->salaryRates->last(fn ($rate) => $rate->effective_date <= $key);
                if ($scheduled && ! $rate) {
                    throw ValidationException::withMessages(['daily_salary' => __('messages.missing_rate')]);
                }
                $absence = $scheduled ? $absences->get($key) : null;
                $base = $scheduled ? $rate->rate_cents : 0;
                // Half-day deductions round half a cent up.
                $deduction = $absence && ! $absence->is_paid
                    ? intdiv($base * (int) ($absence->days * 2) + 1, 2) : 0;
                $day = [
                    'date' => $key, 'rate_cents' => $rate?->rate_cents ?? 0,
                    'scheduled_days' => $scheduled ? 1 : 0,
                    'worked_days' => $scheduled ? 1 - ($absence?->days ?? 0) : 0,
                    'absence_days' => $absence?->days ?? 0,
                    'unpaid_absence_days' => $absence && ! $absence->is_paid ? $absence->days : 0,
                    'base_cents' => $base, 'deduction_cents' => $deduction,
                    'advances_cents' => $advancesByDate->get($key)?->sum('amount_cents') ?? 0,
                    'settled' => false,
                ];
                $day['remaining_cents'] = $day['base_cents'] - $day['deduction_cents'] - $day['advances_cents'];
            }
            foreach (array_keys($totals) as $field) {
                $totals[$field] += $field === 'settled_cents'
                    ? ($day['settled'] ? $day['remaining_cents'] : 0) : $day[$field];
            }
            $daily[] = $day;
        }
        $totals['outstanding_cents'] = $totals['remaining_cents'] - $totals['settled_cents'];

        return [
            'from' => $from, 'to' => $to,
            'employee' => $employee->attributesToArray(),
            'company' => $settings->only(['company_name', 'company_address', 'company_phone', 'currency', 'working_days']),
            'totals' => $totals, 'daily_breakdown' => $daily,
            'advances' => $advances->toArray(),
            'absences' => $employee->absences->whereBetween('date', [$from, $to])->values()->toArray(),
            'salary_rates' => $employee->salaryRates->toArray(),
            'generated_at' => now()->toIso8601String(),
        ];
    }
}
