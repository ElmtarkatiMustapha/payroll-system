<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Setting;
use App\Models\User;
use App\Services\BackupService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class PayrollTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setDate(2026, 10, 1)->startOfDay());
        $this->actingAs(User::factory()->create());
    }

    private function employee(array $overrides = []): Employee
    {
        static $number = 100;
        $number++;
        $data = array_merge([
            'employee_number' => (string) $number, 'name' => 'Test Employee', 'cin' => 'AB'.$number,
            'phone' => '+212612345678', 'start_date' => '2026-08-01', 'end_date' => null,
            'tshirt_size' => 'M', 'trouser_size' => '42', 'daily_salary' => '200.00',
        ], $overrides);
        $response = $this->postJson('/api/employees', $data)->assertCreated();

        return Employee::findOrFail($response->json('id'));
    }

    private function advance(Employee $employee, string $date, string $amount): int
    {
        return $this->postJson("/api/employees/$employee->id/advances", compact('date', 'amount'))->assertCreated()->json('id');
    }

    private function absence(Employee $employee, string $date, float $days = 1, bool $paid = false): int
    {
        return $this->postJson("/api/employees/$employee->id/absences", ['date' => $date, 'days' => $days, 'is_paid' => $paid])->assertCreated()->json('id');
    }

    private function totals(Employee $employee, string $from = '2026-09-01', string $to = '2026-09-30'): array
    {
        return $this->getJson("/api/employees/$employee->id/payroll?from=$from&to=$to")->assertOk()->json('snapshot.totals');
    }

    private function finalize(Employee $employee, string $from = '2026-09-01', string $to = '2026-09-30'): int
    {
        return $this->postJson("/api/employees/$employee->id/statements", compact('from', 'to'))->assertCreated()->json('id');
    }

    public function test_month_uses_scheduled_days_and_deducts_absence_once_and_only_period_advances(): void
    {
        $employee = $this->employee();
        $this->absence($employee, '2026-09-02');
        $this->absence($employee, '2026-09-03');
        $this->advance($employee, '2026-09-05', '1000.00');
        $this->advance($employee, '2026-08-31', '500.00');
        $totals = $this->totals($employee);
        $this->assertEquals(26, $totals['scheduled_days']);
        $this->assertEquals(24, $totals['worked_days']);
        $this->assertEquals(2, $totals['absence_days']);
        $this->assertEquals(520000, $totals['base_cents']);
        $this->assertEquals(40000, $totals['deduction_cents']);
        $this->assertEquals(100000, $totals['advances_cents']);
        $this->assertEquals(380000, $totals['remaining_cents']);
    }

    public function test_salary_history_paid_leave_half_days_and_cents_are_correct(): void
    {
        $employee = $this->employee();
        $this->postJson("/api/employees/$employee->id/salary-rates", ['effective_date' => '2026-09-03', 'daily_salary' => '300.00'])->assertCreated();
        $this->absence($employee, '2026-09-02', .5);
        $this->absence($employee, '2026-09-04', 1, true);
        $this->advance($employee, '2026-09-04', '250.25');
        $totals = $this->totals($employee, '2026-09-01', '2026-09-06');
        $this->assertEquals(5, $totals['scheduled_days']);
        $this->assertEquals(3.5, $totals['worked_days']);
        $this->assertEquals(1.5, $totals['absence_days']);
        $this->assertEquals(.5, $totals['unpaid_absence_days']);
        $this->assertEquals(130000, $totals['base_cents']);
        $this->assertEquals(10000, $totals['deduction_cents']);
        $this->assertEquals(94975, $totals['remaining_cents']);
        $this->assertSame(29, Money::cents(0.29));
        $this->assertSame(20050, Money::cents('200.5'));
    }

    public function test_employment_dates_bound_pay_and_half_cent_rounding_is_consistent(): void
    {
        $employee = $this->employee(['start_date' => '2026-09-03', 'end_date' => '2026-09-04', 'daily_salary' => '199.99']);
        $this->absence($employee, '2026-09-03', .5);
        $totals = $this->totals($employee, '2026-09-01', '2026-09-10');
        $this->assertEquals(2, $totals['scheduled_days']);
        $this->assertEquals(39998, $totals['base_cents']);
        $this->assertEquals(10000, $totals['deduction_cents']);
        $this->assertEquals(29998, $totals['remaining_cents']);
    }

    public function test_invalid_absences_and_advances_are_rejected(): void
    {
        $employee = $this->employee();
        $this->absence($employee, '2026-09-02', .5);
        $this->postJson("/api/employees/$employee->id/absences", ['date' => '2026-09-02', 'days' => .5, 'is_paid' => false])->assertUnprocessable()->assertJsonValidationErrors('date');
        $this->postJson("/api/employees/$employee->id/absences", ['date' => '2026-09-06', 'days' => 1, 'is_paid' => false])->assertUnprocessable()->assertJsonValidationErrors('date');
        $this->postJson("/api/employees/$employee->id/absences", ['date' => '2026-09-03', 'days' => 1.5, 'is_paid' => false])->assertUnprocessable()->assertJsonValidationErrors('days');
        foreach (['-1', '0', '1.234', '1e3'] as $amount) {
            $this->postJson("/api/employees/$employee->id/advances", ['date' => '2026-09-04', 'amount' => $amount])->assertUnprocessable()->assertJsonValidationErrors('amount');
        }
        $this->postJson("/api/employees/$employee->id/advances", ['date' => '2026-07-01', 'amount' => '100'])->assertUnprocessable()->assertJsonValidationErrors('date');
        $this->postJson("/api/employees/$employee->id/advances", ['date' => '2026-10-02', 'amount' => '100'])->assertUnprocessable()->assertJsonValidationErrors('date');
    }

    public function test_entries_can_be_edited_deleted_and_cannot_be_accessed_through_another_employee(): void
    {
        $first = $this->employee();
        $second = $this->employee();
        $advance = $this->advance($first, '2026-09-01', '100');
        $this->putJson("/api/employees/$second->id/advances/$advance", ['date' => '2026-09-02', 'amount' => '200'])->assertNotFound();
        $this->deleteJson("/api/employees/$second->id/advances/$advance")->assertNotFound();
        $this->putJson("/api/employees/$first->id/advances/$advance", ['date' => '2026-09-02', 'amount' => '200.25'])->assertOk()->assertJsonPath('amount_cents', 20025);
        $this->deleteJson("/api/employees/$first->id/advances/$advance")->assertNoContent();
        $absence = $this->absence($first, '2026-09-03');
        $this->putJson("/api/employees/$first->id/absences/$absence", ['date' => '2026-09-04', 'days' => .5, 'is_paid' => true])->assertOk()->assertJsonPath('is_paid', true);
        $this->deleteJson("/api/employees/$first->id/absences/$absence")->assertNoContent();
        $this->assertDatabaseCount('advances', 0);
        $this->assertDatabaseCount('absences', 0);
    }

    public function test_finalized_periods_lock_entries_rates_and_overlap_but_remain_printable(): void
    {
        $employee = $this->employee();
        $advance = $this->advance($employee, '2026-09-01', '100');
        $absence = $this->absence($employee, '2026-09-02');
        $id = $this->finalize($employee);
        $this->deleteJson("/api/employees/$employee->id/advances/$advance")->assertUnprocessable();
        $this->deleteJson("/api/employees/$employee->id/absences/$absence")->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/advances", ['date' => '2026-09-03', 'amount' => '10'])->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/salary-rates", ['effective_date' => '2026-09-03', 'daily_salary' => '300'])->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/statements", ['from' => '2026-09-15', 'to' => '2026-10-01'])->assertUnprocessable();
        $this->getJson("/api/statements/$id")->assertOk()->assertJsonPath('snapshot.totals.remaining_cents', 490000);
        $this->getJson("/api/employees/$employee->id/payroll?from=2026-09-01&to=2026-09-30")->assertOk()->assertJsonPath('statement.id', $id);
    }

    public function test_snapshots_and_dashboard_history_survive_setting_and_profile_changes(): void
    {
        $employee = $this->employee();
        $id = $this->finalize($employee, '2026-09-01', '2026-09-06');
        $original = $this->getJson("/api/statements/$id")->json('snapshot');
        $employee->update(['name' => 'Updated Name', 'tshirt_size' => 'L']);
        Setting::current()->update(['company_name' => 'New company', 'working_days' => [1]]);
        $this->assertSame($original, $this->getJson("/api/statements/$id")->json('snapshot'));
        $totals = $this->totals($employee, '2026-09-01', '2026-09-06');
        $this->assertEquals(5, $totals['scheduled_days']);
        $this->assertEquals(100000, $totals['base_cents']);
    }

    public function test_paid_statements_reduce_outstanding_and_cannot_be_paid_twice(): void
    {
        $employee = $this->employee();
        $id = $this->finalize($employee, '2026-09-01', '2026-09-06');
        $this->postJson("/api/statements/$id/pay", ['paid_on' => '2026-09-05'])->assertUnprocessable();
        $this->postJson("/api/statements/$id/pay", ['paid_on' => '2026-09-07'])->assertOk()->assertJsonPath('status', 'paid');
        $this->getJson('/api/employees?from=2026-09-01&to=2026-09-06')->assertOk()->assertJsonPath('employees.0.totals.outstanding_cents', 0);
        $this->assertEquals(20000, $this->totals($employee, '2026-09-01', '2026-09-07')['outstanding_cents']);
        $this->postJson("/api/statements/$id/pay", ['paid_on' => '2026-09-07'])->assertUnprocessable();
    }

    public function test_period_payroll_deducts_only_its_paid_statements_after_advances_and_absences(): void
    {
        $employee = $this->employee();
        $this->absence($employee, '2026-09-02', .5);
        $this->advance($employee, '2026-09-04', '250');
        $first = $this->finalize($employee, '2026-09-01', '2026-09-06');
        $original = $this->getJson("/api/statements/$first")->json('snapshot');
        $second = $this->finalize($employee, '2026-09-07', '2026-09-08');
        $this->finalize($employee, '2026-09-09', '2026-09-10'); // Finalized, still unpaid.
        $outside = $this->finalize($employee, '2026-08-31', '2026-08-31');
        $other = $this->finalize($this->employee(), '2026-09-01', '2026-09-12');
        foreach ([$first, $second, $outside, $other] as $id) {
            // Payment date is outside the selected period; earnings dates determine attribution.
            $this->postJson("/api/statements/$id/pay", ['paid_on' => '2026-09-15'])->assertOk();
        }

        $totals = $this->totals($employee, '2026-09-01', '2026-09-12');
        $this->assertEquals(220000, $totals['base_cents']);
        $this->assertEquals(10000, $totals['deduction_cents']);
        $this->assertEquals(25000, $totals['advances_cents']);
        $this->assertEquals(105000, $totals['settled_cents']); // 650 + 400, no duplicate advances.
        $this->assertEquals(80000, $totals['outstanding_cents']);

        $overlap = $this->totals($employee, '2026-09-03', '2026-09-07');
        $this->assertEquals(55000, $overlap['settled_cents']);
        $this->assertEquals(0, $overlap['outstanding_cents']);
        $unpaid = $this->totals($employee, '2026-09-09', '2026-09-12');
        $this->assertEquals(0, $unpaid['settled_cents']);
        $this->assertEquals(80000, $unpaid['outstanding_cents']);
        $this->getJson("/api/employees/$employee->id/payroll?from=2026-09-01&to=2026-09-06")
            ->assertOk()->assertJsonPath('statement.status', 'paid')->assertJsonPath('statement.total_cents', 65000);
        $this->assertSame($original, $this->getJson("/api/statements/$first")->json('snapshot'));
    }

    public function test_negative_balances_are_preserved_and_not_marked_as_cash_paid(): void
    {
        $employee = $this->employee();
        $this->advance($employee, '2026-09-01', '300');
        $id = $this->finalize($employee, '2026-09-01', '2026-09-01');
        $this->getJson("/api/statements/$id")->assertJsonPath('total_cents', -10000);
        $this->postJson("/api/statements/$id/pay", ['paid_on' => '2026-09-01'])->assertUnprocessable();
    }

    public function test_period_validation_and_future_finalization(): void
    {
        $employee = $this->employee();
        $this->getJson("/api/employees/$employee->id/payroll?from=2026-09-05&to=2026-09-01")->assertUnprocessable();
        $this->getJson("/api/employees/$employee->id/payroll?from=2024-01-01&to=2026-09-01")->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/statements", ['from' => '2026-10-01', 'to' => '2026-10-02'])->assertUnprocessable();
    }

    public function test_statement_creation_enforces_calendar_eligibility_on_the_server(): void
    {
        $employee = $this->employee(['start_date' => '2026-08-01', 'end_date' => '2026-09-30']);
        $paid = $this->finalize($employee, '2026-08-31', '2026-09-02');
        $this->postJson("/api/statements/$paid/pay", ['paid_on' => '2026-09-03'])->assertOk();
        $unpaid = $this->finalize($employee, '2026-09-10', '2026-09-12');
        foreach ([['2026-08-30', '2026-09-03'], ['2026-09-10', '2026-09-12'], ['2026-09-09', '2026-09-13'],
            ['2026-07-31', '2026-08-02'], ['2026-09-30', '2026-10-01']] as [$from, $to]) {
            $this->postJson("/api/employees/$employee->id/statements", compact('from', 'to'))
                ->assertUnprocessable()->assertJsonValidationErrors('from');
        }
        $this->assertDatabaseCount('payroll_statements', 2);
        $this->getJson("/api/statements/$unpaid")->assertOk()->assertJsonPath('status', 'finalized');
        $this->finalize($employee, '2026-09-03', '2026-09-09');
        $this->assertDatabaseCount('payroll_statements', 3);
    }

    public function test_employee_uniqueness_archive_and_delete_rules(): void
    {
        $employee = $this->employee(['employee_number' => '001']);
        $this->postJson('/api/employees', array_merge($employee->toArray(), ['daily_salary' => '200']))->assertUnprocessable()->assertJsonValidationErrors(['employee_number', 'cin']);
        $this->advance($employee, '2026-09-01', '100');
        $this->deleteJson("/api/employees/$employee->id")->assertUnprocessable();
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => true, 'end_date' => '2026-08-01'])->assertUnprocessable();
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => true, 'end_date' => '2026-09-30'])->assertOk();
        $this->assertNotNull($employee->fresh()->archived_at);
        $this->assertDatabaseCount('advances', 1);
        $empty = $this->employee();
        $this->deleteJson("/api/employees/$empty->id")->assertNoContent();
        $this->assertDatabaseMissing('salary_rates', ['employee_id' => $empty->id]);
    }

    public function test_reactivation_excludes_the_gap_and_keeps_paid_snapshots_and_rates(): void
    {
        $employee = $this->employee();
        $this->absence($employee, '2026-09-02', .5);
        $this->advance($employee, '2026-09-03', '50');
        $id = $this->finalize($employee, '2026-09-01', '2026-09-05');
        $this->postJson("/api/statements/$id/pay", ['paid_on' => '2026-09-05'])->assertOk();
        $original = $this->getJson("/api/statements/$id")->json('snapshot');
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => true, 'end_date' => '2026-09-05'])->assertOk();
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => false, 'return_date' => '2026-09-10'])
            ->assertOk()->assertJsonPath('archived_at', null)->assertJsonPath('start_date', '2026-08-01')
            ->assertJsonPath('end_date', null)->assertJsonCount(2, 'employment_periods')
            ->assertJsonPath('employment_periods.0.end_date', '2026-09-05')
            ->assertJsonPath('employment_periods.1.start_date', '2026-09-10');
        $this->assertSame($original, $this->getJson("/api/statements/$id")->json('snapshot'));
        $this->assertEquals(1, $employee->salaryRates()->count());
        $totals = $this->totals($employee, '2026-09-01', '2026-09-12');
        $this->assertEquals(8, $totals['scheduled_days']);
        $this->assertEquals(7.5, $totals['worked_days']);
        $this->assertEquals(160000, $totals['base_cents']);
        $this->assertEquals(85000, $totals['settled_cents']);
        $this->assertEquals(60000, $totals['outstanding_cents']);
        $gap = $this->totals($employee, '2026-09-06', '2026-09-09');
        $this->assertEquals(0, $gap['scheduled_days']);
        $this->assertEquals(0, $gap['absence_days']);
        $this->assertEquals(0, $gap['remaining_cents']);
        $this->getJson('/api/employees?from=2026-09-10&to=2026-09-12')
            ->assertOk()->assertJsonPath('employees.0.totals.outstanding_cents', 60000);
        $this->postJson("/api/employees/$employee->id/advances", ['date' => '2026-09-09', 'amount' => '10'])->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/absences", ['date' => '2026-09-09', 'days' => 1, 'is_paid' => false])->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/salary-rates", ['effective_date' => '2026-09-09', 'daily_salary' => '300'])->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/statements", ['from' => '2026-09-08', 'to' => '2026-09-11'])->assertUnprocessable();
        $this->finalize($employee, '2026-09-10', '2026-09-12');
    }

    public function test_multiple_returns_preserve_each_gap_and_protect_employment_history(): void
    {
        $employee = $this->employee();
        foreach ([['2026-09-05', '2026-09-10'], ['2026-09-12', '2026-09-16']] as [$end, $return]) {
            $this->patchJson("/api/employees/$employee->id/archive", ['archived' => true, 'end_date' => $end])->assertOk();
            $this->patchJson("/api/employees/$employee->id/archive", ['archived' => true, 'end_date' => $end])->assertUnprocessable();
            $this->patchJson("/api/employees/$employee->id/archive", ['archived' => false, 'return_date' => $return])->assertOk();
        }
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => true, 'end_date' => '2026-09-14'])->assertUnprocessable();
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => false, 'return_date' => '2026-09-17'])->assertUnprocessable();
        $this->postJson("/api/employees/$employee->id/salary-rates", ['effective_date' => '2026-09-16', 'daily_salary' => '250'])->assertCreated();
        $totals = $this->totals($employee, '2026-09-01', '2026-09-18');
        $this->assertEquals(11, $totals['worked_days']);
        $this->assertEquals(235000, $totals['base_cents']);
        $this->assertEquals(0, $this->totals($employee, '2026-09-13', '2026-09-15')['base_cents']);
        $this->assertEquals(3, $employee->employmentPeriods()->count());
        $this->putJson("/api/employees/$employee->id", array_merge($employee->fresh()->toArray(), ['phone' => '+212600001111']))->assertOk();
        $this->putJson("/api/employees/$employee->id", array_merge($employee->fresh()->toArray(), ['start_date' => '2026-07-01']))->assertUnprocessable();
        $this->deleteJson("/api/employees/$employee->id")->assertUnprocessable();
    }

    public function test_return_date_validation_and_legacy_active_employees_with_an_end_date(): void
    {
        // Previous versions could unarchive employees while retaining a closed end date.
        $employee = $this->employee(['end_date' => '2026-09-05']);
        foreach ([null, '2026-09-05', '2026-09-04', '2026-10-02'] as $return) {
            $this->patchJson("/api/employees/$employee->id/archive", ['archived' => false, 'return_date' => $return])
                ->assertUnprocessable()->assertJsonValidationErrors('return_date');
        }
        $this->assertEquals(1, $employee->employmentPeriods()->count());
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => false, 'return_date' => '2026-09-06'])->assertOk();
        // Return is inclusive, but Sunday still earns no salary on a Monday–Saturday calendar.
        $this->assertEquals(0, $this->totals($employee, '2026-09-06', '2026-09-06')['base_cents']);
        $this->assertEquals(20000, $this->totals($employee, '2026-09-07', '2026-09-07')['base_cents']);
        $this->assertTrue($employee->fresh()->coversEmploymentRange('2026-09-04', '2026-09-07'));
        $this->assertEquals('2026-08-01', $employee->fresh()->start_date);
    }

    public function test_migration_backfills_existing_active_and_archived_employee_dates(): void
    {
        $active = $this->employee();
        $archived = $this->employee(['end_date' => '2026-09-05']);
        $archived->update(['archived_at' => now()]);
        $migration = require database_path('migrations/2026_09_13_000001_create_employment_periods_table.php');
        $migration->down();
        $migration->up();
        $this->assertDatabaseCount('employment_periods', 2);
        $this->assertDatabaseHas('employment_periods', ['employee_id' => $active->id, 'start_date' => '2026-08-01', 'end_date' => null]);
        $this->assertDatabaseHas('employment_periods', ['employee_id' => $archived->id, 'start_date' => '2026-08-01', 'end_date' => '2026-09-05']);
        $this->assertNotNull($archived->fresh()->archived_at);
    }

    public function test_backups_preserve_reactivation_periods_and_accept_old_backups(): void
    {
        $employee = $this->employee(['end_date' => '2026-09-05']);
        $backup = app(BackupService::class);
        $legacyPath = $backup->create();
        $legacy = $backup->read($legacyPath);
        $legacy['format'] = 'srt-payroll-v1';
        unset($legacy['tables']['employment_periods']);
        File::put($legacyPath, Crypt::encryptString(gzencode(json_encode($legacy, JSON_THROW_ON_ERROR))));
        $this->patchJson("/api/employees/$employee->id/archive", ['archived' => false, 'return_date' => '2026-09-10'])->assertOk();
        $currentPath = $backup->create();
        try {
            $this->patchJson("/api/employees/$employee->id/archive", ['archived' => true, 'end_date' => '2026-09-12'])->assertOk();
            $backup->restore($currentPath);
            $this->assertEquals(2, $employee->employmentPeriods()->count());
            $this->assertNull($employee->fresh()->end_date);
            $this->assertFalse($employee->fresh()->isEmployedOn('2026-09-09'));
            $this->assertTrue($employee->fresh()->isEmployedOn('2026-09-10'));
            $backup->restore($legacyPath);
            $this->assertEquals(1, $employee->employmentPeriods()->count());
            $this->assertEquals('2026-09-05', $employee->fresh()->end_date);
            $this->assertFalse($employee->fresh()->isEmployedOn('2026-09-10'));
        } finally {
            File::delete([$legacyPath, $currentPath]);
        }
    }

    public function test_initial_rate_can_be_corrected_but_not_removed(): void
    {
        $employee = $this->employee();
        $rate = $employee->salaryRates()->first();
        $this->putJson("/api/employees/$employee->id/salary-rates/$rate->id", ['effective_date' => $employee->start_date, 'daily_salary' => '250'])->assertOk();
        $this->deleteJson("/api/employees/$employee->id/salary-rates/$rate->id")->assertUnprocessable();
        $this->putJson("/api/employees/$employee->id/salary-rates/$rate->id", ['effective_date' => '2026-09-01', 'daily_salary' => '250'])->assertUnprocessable();
    }

    public function test_backups_are_encrypted_and_restore_payroll_records(): void
    {
        $employee = $this->employee();
        $this->advance($employee, '2026-09-01', '200');
        $backup = app(BackupService::class);
        $path = $backup->create();
        try {
            $this->assertStringNotContainsString('Test Employee', File::get($path));
            $employee->update(['name' => 'Changed']);
            $backup->restore($path);
            $this->assertSame('Test Employee', $employee->fresh()->name);
            $this->assertDatabaseCount('advances', 1);
        } finally {
            File::delete($path);
        }
    }

    public function test_exports_have_utf8_bom_and_defuse_spreadsheet_formulas(): void
    {
        $this->employee(['name' => '=HYPERLINK("https://example.com")']);
        $response = $this->get('/api/export/employees?from=2026-09-01&to=2026-09-30&locale=fr')->assertOk();
        $csv = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString('Matricule', $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv);
    }

    public function test_currency_is_protected_after_employee_creation(): void
    {
        $this->employee();
        $this->putJson('/api/settings', array_merge(Setting::current()->toArray(), ['currency' => 'EUR']))->assertUnprocessable()->assertJsonValidationErrors('currency');
    }
}
