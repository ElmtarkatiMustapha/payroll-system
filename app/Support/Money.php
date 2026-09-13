<?php

namespace App\Support;

final class Money
{
    // Convert validated decimals without binary floating-point arithmetic.
    public static function cents(string|int|float $value): int
    {
        $parts = explode('.', (string) $value, 2);

        return ((int) $parts[0] * 100) + (int) str_pad($parts[1] ?? '', 2, '0');
    }

    public static function rules(): array
    {
        return ['required', 'numeric', 'gt:0', 'max:1000000', 'regex:/^\d+(\.\d{1,2})?$/'];
    }
}
