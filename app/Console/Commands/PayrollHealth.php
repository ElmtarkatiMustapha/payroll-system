<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PayrollHealth extends Command
{
    protected $signature = 'payroll:health';

    protected $description = 'Check database and payroll schema availability';

    public function handle(): int
    {
        try {
            DB::table('settings')->where('id', 1)->exists();

            return self::SUCCESS;
        } catch (\Throwable) {
            return self::FAILURE;
        }
    }
}
