<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\EntryController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->group(function () {
    Route::get('session', [AuthController::class, 'session']);
    Route::post('setup', [AuthController::class, 'setup'])->middleware('throttle:5,1');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::middleware('auth')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::put('password', [AuthController::class, 'password'])->middleware('throttle:5,1');
        Route::get('entries/{type}', [EntryController::class, 'index'])->whereIn('type', ['advances', 'absences']);
        Route::get('employees', [EmployeeController::class, 'index']);
        Route::post('employees', [EmployeeController::class, 'store']);
        Route::get('employees/{employee}', [EmployeeController::class, 'show']);
        Route::put('employees/{employee}', [EmployeeController::class, 'update']);
        Route::patch('employees/{employee}/archive', [EmployeeController::class, 'archive']);
        Route::delete('employees/{employee}', [EmployeeController::class, 'destroy']);
        foreach (['advances' => 'advance', 'absences' => 'absence', 'salary-rates' => 'salary'] as $path => $method) {
            Route::post("employees/{employee}/$path", [EntryController::class, $method]);
            Route::match(['put', 'delete'], "employees/{employee}/$path/{entry}", [EntryController::class, $method])->whereNumber('entry');
        }
        Route::get('employees/{employee}/payroll', [PayrollController::class, 'preview']);
        Route::post('employees/{employee}/statements', [PayrollController::class, 'store']);
        Route::get('statements', [PayrollController::class, 'index']);
        Route::get('statements/{statement}', [PayrollController::class, 'show']);
        Route::post('statements/{statement}/pay', [PayrollController::class, 'pay']);
        Route::put('settings', [SettingsController::class, 'update']);
        Route::post('backup', [SettingsController::class, 'backup'])->middleware('throttle:3,1');
        Route::get('export/{type}', [ExportController::class, 'download'])->whereIn('type', ['employees', 'advances', 'absences', 'statements']);
    });
    Route::fallback(fn () => response()->json(['message' => __('messages.not_found')], 404));
});
Route::view('/login', 'app')->name('login');
Route::view('/{path?}', 'app')->where('path', '^(?!api(?:/|$)|build(?:/|$)).*');
