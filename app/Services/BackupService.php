<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class BackupService
{
    public const TABLES = ['users', 'settings', 'employees', 'employment_periods', 'salary_rates', 'advances', 'absences', 'payroll_statements'];

    public function create(): string
    {
        $payload = DB::transaction(function () {
            $tables = [];
            foreach (self::TABLES as $table) {
                $tables[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
            }

            return ['format' => 'srt-payroll-v2', 'created_at' => now()->toIso8601String(), 'tables' => $tables];
        });
        $directory = storage_path('app/private/backups');
        File::ensureDirectoryExists($directory);
        $path = $directory.'/payroll-'.now()->format('Y-m-d-His').'-'.bin2hex(random_bytes(4)).'.payroll-backup';
        File::put($path, Crypt::encryptString(gzencode(json_encode($payload, JSON_THROW_ON_ERROR))));

        return $path;
    }

    public function read(string $path): array
    {
        $data = json_decode(gzdecode(Crypt::decryptString(File::get($path))), true, 512, JSON_THROW_ON_ERROR);
        $legacyTables = array_values(array_diff(self::TABLES, ['employment_periods']));
        $legacy = ($data['format'] ?? null) === 'srt-payroll-v1';
        if ((! $legacy && ($data['format'] ?? null) !== 'srt-payroll-v2')
            || array_keys($data['tables'] ?? []) !== ($legacy ? $legacyTables : self::TABLES)) {
            throw new \RuntimeException('Invalid payroll backup.');
        }
        if ($legacy) {
            // Older backups contain one employment interval in each employee record.
            $periods = array_map(fn ($employee) => [
                'id' => $employee['id'], 'employee_id' => $employee['id'],
                'start_date' => $employee['start_date'], 'end_date' => $employee['end_date'],
                'created_at' => $employee['created_at'], 'updated_at' => $employee['updated_at'],
            ], $data['tables']['employees']);
            $tables = [];
            foreach (self::TABLES as $table) {
                $tables[$table] = $table === 'employment_periods' ? $periods : $data['tables'][$table];
            }
            $data['tables'] = $tables;
        }

        return $data;
    }

    public function restore(string $path): void
    {
        $data = $this->read($path);
        DB::transaction(function () use ($data) {
            DB::table('sessions')->delete();
            DB::table('password_reset_tokens')->delete();
            foreach (array_reverse(self::TABLES) as $table) {
                DB::table($table)->delete();
            }
            foreach (self::TABLES as $table) {
                foreach (array_chunk($data['tables'][$table], 100) as $chunk) {
                    DB::table($table)->insert($chunk);
                }
            }
        });
    }
}
