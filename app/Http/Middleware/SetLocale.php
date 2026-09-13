<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SetLocale
{
    public function handle(Request $request, Closure $next)
    {
        $locale = $request->header('X-Locale', $request->query('locale', $request->session()->get('locale', 'en')));
        if (! in_array($locale, ['en', 'fr', 'ar'], true)) {
            $locale = 'en';
        }
        app()->setLocale($locale);
        $request->session()->put('locale', $locale);
        $response = $next($request);
        if ($request->is('api/*')) {
            $response->headers->set('Cache-Control', 'no-store, private');
        }
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('Referrer-Policy', 'same-origin');

        return $response;
    }
}
