<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_sensitive_endpoints_require_authentication(): void
    {
        foreach (['/api/employees?from=2026-09-01&to=2026-09-30', '/api/statements', '/api/export/employees?from=2026-09-01&to=2026-09-30'] as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        $this->postJson('/api/backup')->assertUnauthorized();
        $this->postJson('/api/employees', [])->assertUnauthorized();
    }

    public function test_first_run_setup_creates_one_hashed_administrator_and_closes_registration(): void
    {
        $this->getJson('/api/session')->assertJsonPath('setup_required', true);
        $payload = ['name' => 'Administrator', 'company_name' => 'SRT', 'email' => 'admin@example.test', 'password' => 'LongPassword-2026', 'password_confirmation' => 'LongPassword-2026'];
        $this->postJson('/api/setup', $payload)->assertOk()->assertJsonPath('setup_required', false)->assertJsonMissingPath('user.password');
        $this->assertTrue(Hash::check('LongPassword-2026', User::first()->password));
        $this->postJson('/api/setup', array_merge($payload, ['email' => 'another@example.test']))->assertForbidden();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_login_logout_and_password_changes(): void
    {
        $user = User::factory()->create(['password' => 'Original-password-2026']);
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'Original-password-2026'])->assertOk();
        $this->assertAuthenticatedAs($user);
        $this->putJson('/api/password', ['current_password' => 'wrong', 'password' => 'Updated-password-2026', 'password_confirmation' => 'Updated-password-2026'])->assertUnprocessable();
        $this->putJson('/api/password', ['current_password' => 'Original-password-2026', 'password' => 'Updated-password-2026', 'password_confirmation' => 'Updated-password-2026'])->assertOk();
        $this->assertTrue(Hash::check('Updated-password-2026', $user->fresh()->password));
        $this->postJson('/api/logout')->assertOk();
        $this->assertGuest();
    }

    public function test_validation_is_available_in_french_and_arabic(): void
    {
        $this->postJson('/api/login', [], ['X-Locale' => 'fr'])->assertUnprocessable()->assertJsonPath('errors.email.0', 'Le champ Adresse e-mail est obligatoire.');
        $this->postJson('/api/login', [], ['X-Locale' => 'ar'])->assertUnprocessable()->assertJsonPath('errors.email.0', 'حقل البريد الإلكتروني مطلوب.');
    }

    public function test_repeated_login_attempts_are_throttled(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'unknown@example.test', 'password' => 'wrong'])->assertUnprocessable();
        }
        $this->postJson('/api/login', ['email' => 'unknown@example.test', 'password' => 'wrong'])->assertTooManyRequests();
    }
}
