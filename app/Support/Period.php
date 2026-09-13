<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class Period
{
    public static function validate(Request $request): array
    {
        $data = $request->validate([
            'from' => 'required|date_format:Y-m-d',
            'to' => 'required|date_format:Y-m-d|after_or_equal:from',
        ]);
        if (CarbonImmutable::parse($data['from'])->diffInDays($data['to']) > 365) {
            throw ValidationException::withMessages(['to' => __('messages.period_too_long')]);
        }

        return [$data['from'], $data['to']];
    }
}
