<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name')->default('SRT Payroll');
            $table->string('company_address')->nullable();
            $table->string('company_phone', 40)->nullable();
            $table->string('currency', 3)->default('MAD');
            $table->string('locale', 2)->default('en');
            $table->json('working_days');
            $table->timestamps();
        });
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_number', 30)->unique();
            $table->string('name');
            $table->string('cin', 30)->unique();
            $table->string('phone', 40);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('tshirt_size', 10);
            $table->string('trouser_size', 10);
            $table->text('notes')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });
        Schema::create('salary_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->date('effective_date');
            $table->unsignedBigInteger('rate_cents');
            $table->timestamps();
            $table->unique(['employee_id', 'effective_date']);
        });
        Schema::create('advances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->date('date');
            $table->unsignedBigInteger('amount_cents');
            $table->string('note', 1000)->nullable();
            $table->timestamps();
            $table->index(['employee_id', 'date']);
        });
        Schema::create('absences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->date('date');
            $table->decimal('days', 2, 1)->default(1);
            $table->boolean('is_paid')->default(false);
            $table->string('reason', 1000)->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'date']);
        });
        Schema::create('payroll_statements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->date('from');
            $table->date('to');
            $table->string('status', 20)->default('finalized');
            $table->date('paid_on')->nullable();
            $table->bigInteger('total_cents');
            $table->json('snapshot');
            $table->timestamps();
            $table->index(['employee_id', 'from', 'to']);
        });
        DB::table('settings')->insert([
            'id' => 1, 'company_name' => 'SRT Payroll', 'currency' => 'MAD', 'locale' => 'en',
            'working_days' => json_encode([1, 2, 3, 4, 5, 6]), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        foreach (['payroll_statements', 'absences', 'advances', 'salary_rates', 'employees', 'settings'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
