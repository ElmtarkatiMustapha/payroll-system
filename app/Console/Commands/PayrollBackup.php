<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

class PayrollBackup extends Command
{
    protected $signature = 'payroll:backup';

    protected $description = 'Create an encrypted backup of payroll data and administrator accounts';

    public function handle(BackupService $backup): int
    {
        $this->info($backup->create());

        return self::SUCCESS;
    }
}
