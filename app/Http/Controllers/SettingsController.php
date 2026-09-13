<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Setting;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SettingsController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:255',
            'company_address' => 'nullable|string|max:255',
            'company_phone' => 'nullable|string|max:40',
            'currency' => ['required', Rule::in(['MAD', 'EUR', 'USD', 'GBP', 'CAD', 'CHF', 'DZD', 'SAR', 'AED'])],
            'locale' => ['required', Rule::in(['en', 'fr', 'ar'])],
            'working_days' => 'required|array|min:1|max:7',
            'working_days.*' => 'required|integer|between:1,7|distinct',
        ]);

        return DB::transaction(function () use ($data) {
            $settings = Setting::lockForUpdate()->findOrFail(1);
            if ($data['currency'] !== $settings->currency && Employee::exists()) {
                throw ValidationException::withMessages(['currency' => __('messages.currency_locked')]);
            }
            $settings->update($data);

            return response()->json($settings);
        });
    }

    public function backup(BackupService $backup)
    {
        $path = $backup->create();

        return response()->download($path, basename($path), ['Cache-Control' => 'no-store']);
    }
}
