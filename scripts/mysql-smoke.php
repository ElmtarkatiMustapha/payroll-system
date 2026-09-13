<?php

use App\Models\Employee;
use App\Models\Setting;
use App\Models\User;
use App\Services\PayrollCalculator;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (DB::getDriverName() !== 'mysql') {
    throw new RuntimeException('This check requires MySQL.');
}

// Smoke-test real MySQL types and transactions without retaining test records.
DB::beginTransaction();
try {
    Setting::current()->update(['working_days' => [1, 2, 3, 4, 5, 6]]);
    $key = bin2hex(random_bytes(6));
    $user = User::create(['name' => 'Runtime check', 'email' => "$key@example.invalid", 'password' => bin2hex(random_bytes(20))]);
    $employee = Employee::create([
        'name' => 'فحص الراتب', 'employee_number' => 'smoke-'.$key, 'cin' => 'smoke-'.$key,
        'phone' => '+212600000000', 'start_date' => '2026-09-01', 'tshirt_size' => 'M', 'trouser_size' => '42',
    ]);
    $employee->salaryRates()->create(['effective_date' => '2026-09-01', 'rate_cents' => 20025]);
    $employee->advances()->create(['date' => '2026-09-01', 'amount_cents' => 15025]);
    $employee->absences()->create(['date' => '2026-09-02', 'days' => .5, 'is_paid' => false]);
    $snapshot = app(PayrollCalculator::class)->calculate($employee, '2026-09-01', '2026-09-06');
    if ($snapshot['totals']['remaining_cents'] !== 75087) {
        throw new RuntimeException('MySQL payroll arithmetic did not match.');
    }
    $statement = $employee->statements()->create([
        'created_by' => $user->id, 'from' => '2026-09-01', 'to' => '2026-09-06',
        'total_cents' => 75087, 'snapshot' => $snapshot, 'status' => 'paid', 'paid_on' => '2026-09-07',
    ]);
    if ($statement->fresh()->snapshot['employee']['name'] !== 'فحص الراتب') {
        throw new RuntimeException('Arabic JSON snapshot did not round-trip.');
    }
    $updated = app(PayrollCalculator::class)->calculate($employee->fresh(), '2026-09-01', '2026-09-06');
    if ($updated['totals']['outstanding_cents'] !== 0) {
        throw new RuntimeException('Paid statement was not reflected in outstanding pay.');
    }
    echo "MySQL payroll, Arabic snapshot, and settlement checks passed. Test records rolled back.\n";
} finally {
    DB::rollBack();
}
