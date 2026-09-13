<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Setting;
use App\Services\PayrollGuard;
use App\Support\Money;
use App\Support\Period;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EntryController extends Controller
{
    public function index(Request $request, string $type)
    {
        [$from, $to] = Period::validate($request);

        return response()->json(DB::table($type)->join('employees', 'employees.id', '=', "$type.employee_id")
            ->whereBetween("$type.date", [$from, $to])->orderByDesc("$type.date")->orderByDesc("$type.id")
            ->select(["$type.*", 'employees.name', 'employees.employee_number'])->get());
    }

    public function advance(Request $request, Employee $employee, ?int $entry = null)
    {
        return DB::transaction(function () use ($request, $employee, $entry) {
            $employee = Employee::lockForUpdate()->findOrFail($employee->id);
            $existing = $entry ? $employee->advances()->findOrFail($entry) : null;
            if ($existing) {
                PayrollGuard::dateIsEditable($employee, $existing->date);
            }
            if ($request->isMethod('delete')) {
                $existing->delete();

                return response()->noContent();
            }
            $data = $request->validate(['date' => 'required|date_format:Y-m-d|before_or_equal:today', 'amount' => Money::rules(), 'note' => 'nullable|string|max:1000']);
            PayrollGuard::dateIsEditable($employee, $data['date']);
            PayrollGuard::employmentDate($employee, $data['date']);
            $attributes = ['date' => $data['date'], 'amount_cents' => Money::cents($data['amount']), 'note' => $data['note'] ?? null];
            if ($existing) {
                $existing->update($attributes);
            } else {
                $existing = $employee->advances()->create($attributes);
            }

            return response()->json($existing, $entry ? 200 : 201);
        });
    }

    public function absence(Request $request, Employee $employee, ?int $entry = null)
    {
        return DB::transaction(function () use ($request, $employee, $entry) {
            $employee = Employee::lockForUpdate()->findOrFail($employee->id);
            $existing = $entry ? $employee->absences()->findOrFail($entry) : null;
            if ($existing) {
                PayrollGuard::dateIsEditable($employee, $existing->date);
            }
            if ($request->isMethod('delete')) {
                $existing->delete();

                return response()->noContent();
            }
            $data = $request->validate([
                'date' => ['required', 'date_format:Y-m-d', Rule::unique('absences')->where('employee_id', $employee->id)->ignore($entry)],
                'days' => ['required', 'numeric', Rule::in([0.5, 1])],
                'is_paid' => 'required|boolean',
                'reason' => 'nullable|string|max:1000',
            ]);
            PayrollGuard::dateIsEditable($employee, $data['date']);
            PayrollGuard::employmentDate($employee, $data['date']);
            if (! in_array(CarbonImmutable::parse($data['date'])->dayOfWeekIso, Setting::current()->working_days, true)) {
                throw ValidationException::withMessages(['date' => __('messages.non_working_day')]);
            }
            if ($existing) {
                $existing->update($data);
            } else {
                $existing = $employee->absences()->create($data);
            }

            return response()->json($existing, $entry ? 200 : 201);
        });
    }

    public function salary(Request $request, Employee $employee, ?int $entry = null)
    {
        return DB::transaction(function () use ($request, $employee, $entry) {
            $employee = Employee::lockForUpdate()->findOrFail($employee->id);
            $existing = $entry ? $employee->salaryRates()->findOrFail($entry) : null;
            if ($existing) {
                PayrollGuard::salaryIsEditable($employee, $existing->effective_date);
            }
            if ($request->isMethod('delete')) {
                if ($employee->salaryRates()->first()->id === $existing->id) {
                    throw ValidationException::withMessages(['effective_date' => __('messages.initial_rate_required')]);
                }
                $existing->delete();

                return response()->noContent();
            }
            $data = $request->validate([
                'effective_date' => ['required', 'date_format:Y-m-d', Rule::unique('salary_rates')->where('employee_id', $employee->id)->ignore($entry)],
                'daily_salary' => Money::rules(),
            ]);
            PayrollGuard::salaryIsEditable($employee, $data['effective_date']);
            PayrollGuard::employmentDate($employee, $data['effective_date']);
            if ($existing && $employee->salaryRates()->first()->id === $existing->id && $data['effective_date'] !== $employee->start_date) {
                throw ValidationException::withMessages(['effective_date' => __('messages.initial_rate_required')]);
            }
            $attributes = ['effective_date' => $data['effective_date'], 'rate_cents' => Money::cents($data['daily_salary'])];
            if ($existing) {
                $existing->update($attributes);
            } else {
                $existing = $employee->salaryRates()->create($attributes);
            }

            return response()->json($existing, $entry ? 200 : 201);
        });
    }
}
