<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function session(Request $request)
    {
        $settings = Setting::current();

        return response()->json([
            'user' => $request->user(),
            'setup_required' => ! User::exists(),
            'settings' => $request->user() ? $settings : $settings->only(['company_name', 'locale']),
            'csrf_token' => csrf_token(),
        ]);
    }

    public function setup(Request $request)
    {
        abort_if(User::exists(), 403);
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Password::min(12)],
            'company_name' => 'required|string|max:255',
        ]);
        Setting::current();
        $user = DB::transaction(function () use ($data) {
            $settings = Setting::lockForUpdate()->findOrFail(1);
            abort_if(User::exists(), 403);
            $settings->update(['company_name' => $data['company_name']]);

            return User::create(collect($data)->only(['name', 'email', 'password'])->all());
        });
        Auth::login($user);
        $request->session()->regenerate();

        return $this->session($request);
    }

    public function login(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string']);
        if (! Auth::attempt($data)) {
            throw ValidationException::withMessages(['email' => __('messages.invalid_login')]);
        }
        $request->session()->regenerate();

        return $this->session($request);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['csrf_token' => csrf_token()]);
    }

    public function password(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(12), 'different:current_password'],
        ]);
        $request->user()->update(['password' => Hash::make($data['password']), 'remember_token' => null]);
        DB::table('sessions')->where('user_id', $request->user()->id)->where('id', '!=', $request->session()->getId())->delete();
        $request->session()->regenerate();

        return response()->json(['csrf_token' => csrf_token()]);
    }
}
