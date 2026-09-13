<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

class PayrollRestore extends Command
{
    protected $signature = 'payroll:restore {file} {--force : Replace existing data without an interactive prompt}';

    protected $description = 'Restore an encrypted payroll backup, replacing current payroll data';

    public function handle(BackupService $backup): int
    {
        $backup->read($this->argument('file'));
        if (! $this->option('force') && ! $this->confirm('This replaces all payroll data and administrator accounts. Continue?')) {
            return self::FAILURE;
        }
        $backup->restore($this->argument('file'));
        $this->info('Backup restored. All sessions have been signed out.');

        return self::SUCCESS;
    }
}
