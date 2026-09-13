<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" dir="{{ app()->getLocale() === 'ar' ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#146c52">
    <title>SRT Payroll</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    @viteReactRefresh
    @vite('resources/js/app.jsx')
</head>
<body>
    <div id="app"></div>
    <noscript>Enable JavaScript / Activez JavaScript / يرجى تفعيل جافاسكريبت</noscript>
</body>
</html>
