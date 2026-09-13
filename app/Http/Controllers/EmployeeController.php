<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Setting;
use App\Services\PayrollCalculator;
use App\Support\Money;
use App\Support\Period;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeController extends Controller
{
    public function index(Request $request, PayrollCalculator $calculator)
    {
        [$from, $to] = Period::validate($request);
        $employees = Employee::with(['salaryRates', 'advances', 'absences', 'statements', 'employmentPeriods'])->orderBy('name')->get();
        $rows = $employees->map(function (Employee $employee) use ($calculator, $from, $to) {
            $rate = $employee->salaryRates->last(fn ($rate) => $rate->effective_date <= now()->toDateString());

            return array_merge($employee->attributesToArray(), [
                'daily_salary_cents' => $rate?->rate_cents ?? $employee->salaryRates->first()?->rate_cents ?? 0,
                'employment_periods' => $employee->employmentPeriods->toArray(),
                'totals' => $calculator->calculate($employee, $from, $to)['totals'],
            ]);
        });

        return response()->json(['employees' => $rows, 'from' => $from, 'to' => $to]);
    }

    public function show(Employee $employee)
    {
        $employee->load(['salaryRates', 'advances', 'absences', 'statements', 'employmentPeriods']);

        return response()->json($employee);
    }

    private function validated(Request $request, ?Employee $employee = null): array
    {
        $request->merge(['cin' => mb_strtoupper(trim((string) $request->input('cin')))]);

        return $request->validate([
            'employee_number' => ['required', 'string', 'max:30', 'regex:/^\d+$/', Rule::unique('employees')->ignore($employee?->id)],
            'name' => 'required|string|max:255',
            'cin' => ['required', 'string', 'max:30', Rule::unique('employees')->ignore($employee?->id)],
            'phone' => ['required', 'string', 'max:40', 'regex:/^[+0-9 ()-]{6,40}$/'],
            'start_date' => 'required|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
            'tshirt_size' => ['required', Rule::in(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'])],
            'trouser_size' => 'required|string|max:10',
            'notes' => 'nullable|string|max:2000',
            'daily_salary' => $employee ? ['sometimes', ...Money::rules()] : Money::rules(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $employee = DB::transaction(function () use ($data) {
            Setting::lockForUpdate()->findOrFail(1);
            $employee = Employee::create(collect($data)->except('daily_salary')->all());
            $employee->employmentPeriods()->create(['start_date' => $data['start_date'], 'end_date' => $data['end_date'] ?? null]);
            $employee->salaryRates()->create(['effective_date' => $data['start_date'], 'rate_cents' => Money::cents($data['daily_salary'])]);

            return $employee;
        });

        return response()->json($employee, 201);
    }

    public function update(Request $request, Employee $employee)
    {
        $data = $this->validated($request, $employee);

        return DB::transaction(function () use ($employee, $data) {
            $employee = Employee::lockForUpdate()->findOrFail($employee->id);
            $datesChanged = $data['start_date'] !== $employee->start_date || ($data['end_date'] ?? null) !== $employee->end_date;
            if ($datesChanged && ($employee->statements()->exists() || $employee->archived_at || $employee->employmentPeriods()->count() > 1)) {
                throw ValidationException::withMessages(['start_date' => __('messages.employment_locked')]);
            }
            if ($datesChanged) {
                foreach (['advances', 'absences'] as $relation) {
                    if ($employee->{$relation}()->where(function ($q) use ($data) {
                        $q->where('date', '<', $data['start_date']);
                        if ($data['end_date'] ?? null) {
                            $q->orWhere('date', '>', $data['end_date']);
                        }
                    })->exists()) {
                        throw ValidationException::withMessages(['start_date' => __('messages.existing_records_outside')]);
                    }
                }
                if ($data['start_date'] !== $employee->start_date) {
                    $initialRate = $employee->salaryRates()->first();
                    if ($employee->salaryRates()->where('id', '!=', $initialRate->id)->where('effective_date', '<=', $data['start_date'])->exists()) {
                        throw ValidationException::withMessages(['start_date' => __('messages.rate_conflict')]);
                    }
                    $initialRate->update(['effective_date' => $data['start_date']]);
                }
            }
            $employee->update(collect($data)->except('daily_salary')->all());
            if ($datesChanged) {
                $employee->employmentPeriods()->firstOrFail()->update(['start_date' => $employee->start_date, 'end_date' => $employee->end_date]);
            }

            return response()->json($employee);
        });
    }

    public function archive(Request $request, Employee $employee)
    {
        $data = $request->validate([
            'archived' => 'required|boolean', 'end_date' => 'nullable|date_format:Y-m-d',
            'return_date' => 'required_if:archived,false|nullable|date_format:Y-m-d|before_or_equal:today',
        ]);

        return DB::transaction(function () use ($employee, $data) {
            $employee = Employee::lockForUpdate()->findOrFail($employee->id);
            $current = $employee->employmentPeriods()->reorder()->orderByDesc('start_date')->firstOrFail();
            if ($data['archived']) {
                if ($employee->archived_at) {
                    throw ValidationException::withMessages(['end_date' => __('messages.employment_state_changed')]);
                }
                $end = $data['end_date'] ?? now()->toDateString();
                if ($end < $current->start_date || $employee->advances()->where('date', '>', $end)->exists()
                    || $employee->absences()->where('date', '>', $end)->exists()
                    || $employee->statements()->where('to', '>', $end)->exists()) {
                    throw ValidationException::withMessages(['end_date' => __('messages.archive_date')]);
                }
                $current->update(['end_date' => $end]);
                $employee->update(['archived_at' => now(), 'end_date' => $end]);
            } else {
                if (! $current->end_date) {
                    throw ValidationException::withMessages(['return_date' => __('messages.employment_state_changed')]);
                }
                if ($data['return_date'] <= $current->end_date) {
                    throw ValidationException::withMessages(['return_date' => __('messages.return_after_end')]);
                }
                // Keep the closed period; a new period starts on the chosen return date.
                $employee->employmentPeriods()->create(['start_date' => $data['return_date'], 'end_date' => null]);
                $employee->update(['archived_at' => null, 'end_date' => null]);
            }

            return response()->json($employee->load('employmentPeriods'));
        });
    }

    public function destroy(Employee $employee)
    {
        DB::transaction(function () use ($employee) {
            $employee = Employee::lockForUpdate()->findOrFail($employee->id);
            if ($employee->advances()->exists() || $employee->absences()->exists() || $employee->statements()->exists() || $employee->employmentPeriods()->count() > 1) {
                throw ValidationException::withMessages(['employee' => __('messages.archive_instead')]);
            }
            $employee->delete();
        });

        return response()->noContent();
    }
}
