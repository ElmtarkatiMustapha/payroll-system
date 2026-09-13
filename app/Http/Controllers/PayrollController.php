<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\PayrollStatement;
use App\Models\Setting;
use App\Services\PayrollCalculator;
use App\Support\Period;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayrollController extends Controller
{
    public function index()
    {
        return response()->json(PayrollStatement::with('employee:id,name,employee_number')->select(['id', 'employee_id', 'from', 'to', 'status', 'paid_on', 'total_cents', 'created_at'])->latest()->get());
    }

    public function show(PayrollStatement $statement)
    {
        return response()->json($statement);
    }

    public function preview(Request $request, Employee $employee, PayrollCalculator $calculator)
    {
        [$from, $to] = Period::validate($request);
        $existing = $employee->statements()->where('from', $from)->where('to', $to)->first();

        return response()->json(['snapshot' => $existing?->snapshot ?? $calculator->calculate($employee, $from, $to), 'statement' => $existing]);
    }

    public function store(Request $request, Employee $employee, PayrollCalculator $calculator)
    {
        [$from, $to] = Period::validate($request);
        $request->validate(['to' => 'before_or_equal:today']);

        return DB::transaction(function () use ($employee, $from, $to, $calculator, $request) {
            // Settings are locked before employees consistently when finalizing payroll.
            Setting::lockForUpdate()->findOrFail(1);
            $employee = Employee::lockForUpdate()->findOrFail($employee->id);
            if ($from < $employee->start_date || ($employee->end_date && $to > $employee->end_date)) {
                throw ValidationException::withMessages(['from' => __('messages.outside_employment')]);
            }
            if ($employee->statements()->where('from', '<=', $to)->where('to', '>=', $from)->exists()) {
                throw ValidationException::withMessages(['from' => __('messages.overlapping_statement')]);
            }
            $snapshot = $calculator->calculate($employee, $from, $to);
            $statement = $employee->statements()->create([
                'created_by' => $request->user()->id, 'from' => $from, 'to' => $to,
                'total_cents' => $snapshot['totals']['remaining_cents'], 'snapshot' => $snapshot,
            ]);

            return response()->json($statement, 201);
        });
    }

    public function pay(Request $request, PayrollStatement $statement)
    {
        $data = $request->validate(['paid_on' => 'required|date_format:Y-m-d|before_or_equal:today']);

        return DB::transaction(function () use ($statement, $data) {
            $statement = PayrollStatement::lockForUpdate()->findOrFail($statement->id);
            if ($statement->status === 'paid') {
                throw ValidationException::withMessages(['paid_on' => __('messages.already_paid')]);
            }
            if ($data['paid_on'] < $statement->to || $statement->total_cents < 0) {
                throw ValidationException::withMessages(['paid_on' => __('messages.invalid_payment')]);
            }
            $statement->update(['status' => 'paid', 'paid_on' => $data['paid_on']]);

            return response()->json($statement);
        });
    }
}
