<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class BackupService
{
    public const TABLES = ['users', 'settings', 'employees', 'salary_rates', 'advances', 'absences', 'payroll_statements'];

    public function create(): string
    {
        $payload = DB::transaction(function () {
            $tables = [];
            foreach (self::TABLES as $table) {
                $tables[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
            }

            return ['format' => 'srt-payroll-v1', 'created_at' => now()->toIso8601String(), 'tables' => $tables];
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
        if (($data['format'] ?? null) !== 'srt-payroll-v1' || array_keys($data['tables'] ?? []) !== self::TABLES) {
            throw new \RuntimeException('Invalid payroll backup.');
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
