<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employment_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'start_date']);
        });

        // Preserve every existing employee's dates, including archived employees.
        DB::table('employees')->orderBy('id')->chunkById(200, function ($employees) {
            DB::table('employment_periods')->insert($employees->map(fn ($employee) => [
                'employee_id' => $employee->id, 'start_date' => $employee->start_date,
                'end_date' => $employee->end_date, 'created_at' => $employee->created_at,
                'updated_at' => $employee->updated_at,
            ])->all());
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employment_periods');
    }
};
