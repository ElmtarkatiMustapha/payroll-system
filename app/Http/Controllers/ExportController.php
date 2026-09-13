<?php

namespace App\Http\Controllers;

use App\Models\Absence;
use App\Models\Advance;
use App\Models\Employee;
use App\Models\PayrollStatement;
use App\Models\Setting;
use App\Support\Period;
use Illuminate\Http\Request;

class ExportController extends Controller
{
    public function download(Request $request, string $type)
    {
        [$from, $to] = Period::validate($request);
        $employees = Employee::all()->keyBy('id');
        $currency = Setting::current()->currency;
        $headers = match ($type) {
            'employees' => ['employee_number', 'name', 'cin', 'phone', 'start_date', 'end_date', 'tshirt_size', 'trouser_size', 'status'],
            'advances' => ['employee_number', 'name', 'date', 'amount', 'currency', 'note'],
            'absences' => ['employee_number', 'name', 'date', 'days', 'is_paid', 'reason'],
            'statements' => ['reference', 'employee_number', 'name', 'from', 'to', 'remaining', 'currency', 'status', 'paid_on'],
        };
        $rows = match ($type) {
            'employees' => $employees->values()->map(fn ($e) => [$e->employee_number, $e->name, $e->cin, $e->phone, $e->start_date, $e->end_date, $e->tshirt_size, $e->trouser_size, __('messages.'.($e->archived_at ? 'archived' : 'active'))]),
            'advances' => Advance::whereBetween('date', [$from, $to])->orderBy('date')->get()->map(fn ($a) => [$employees[$a->employee_id]->employee_number, $employees[$a->employee_id]->name, $a->date, number_format($a->amount_cents / 100, 2, '.', ''), $currency, $a->note]),
            'absences' => Absence::whereBetween('date', [$from, $to])->orderBy('date')->get()->map(fn ($a) => [$employees[$a->employee_id]->employee_number, $employees[$a->employee_id]->name, $a->date, $a->days, __('messages.'.($a->is_paid ? 'yes' : 'no')), $a->reason]),
            'statements' => PayrollStatement::where('from', '<=', $to)->where('to', '>=', $from)->orderBy('from')->get()->map(fn ($s) => ['PAY-'.str_pad($s->id, 5, '0', STR_PAD_LEFT), $s->snapshot['employee']['employee_number'], $s->snapshot['employee']['name'], $s->from, $s->to, number_format($s->total_cents / 100, 2, '.', ''), $s->snapshot['company']['currency'], __('messages.'.$s->status), $s->paid_on]),
        };

        return response()->streamDownload(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_map(fn ($header) => __('messages.'.$header), $headers), ',', '"', '');
            foreach ($rows as $row) {
                // Prevent spreadsheet formulas in user-entered strings.
                $safe = array_map(fn ($value) => is_string($value) && preg_match('/^[\s]*[=+\-@\t\r\n]/u', $value) ? "'".$value : $value, $row);
                fputcsv($handle, $safe, ',', '"', '');
            }
            fclose($handle);
        }, "$type-$from-$to.csv", ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }
}
