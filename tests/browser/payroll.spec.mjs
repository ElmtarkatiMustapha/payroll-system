import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const credentials = { email: 'admin@payroll.test', password: 'Test-password-2026' };
const date = new Date();
const iso = value => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
const monthStart = iso(new Date(date.getFullYear(), date.getMonth(), 1));
const workDate = (() => { const d = new Date(date.getFullYear(), date.getMonth(), 1); if (d.getDay() === 0) d.setDate(2); return iso(d); })();
const periodEnd = iso(date);
const errors = [];

async function login(page) {
    await page.goto('/');
    await page.getByLabel('Email address', { exact: true }).fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your team, at a glance' })).toBeVisible();
}
async function request(page, path, method, data) {
    const token = (await (await page.request.get('/api/session')).json()).csrf_token;
    return page.request.fetch('/api' + path, { method, data, headers: { 'X-CSRF-TOKEN': token, 'Accept': 'application/json', 'X-Locale': 'en' } });
}
test.describe.serial('Payroll workspace', () => {
    test('first run, employee CRUD, advances, absences, rates and finalized payments', async ({ page }) => {
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Make room for better payroll.' })).toBeVisible();
        await page.getByLabel('Your full name').fill('Sara Admin');
        await page.getByLabel('Company name').fill('SRT Construction');
        await page.getByLabel('Email address', { exact: true }).fill(credentials.email);
        await page.getByLabel('Password', { exact: true }).fill(credentials.password);
        await page.getByLabel('Confirm password', { exact: true }).fill(credentials.password);
        await page.getByRole('button', { name: 'Create workspace' }).click();
        await expect(page.getByRole('heading', { name: 'Your team, at a glance' })).toBeVisible();
        await page.getByRole('button', { name: 'Add employee', exact: true }).first().click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Full name').fill('Youssef El Amrani');
        await dialog.getByLabel('Employee number').fill('001');
        await dialog.getByLabel('CIN', { exact: true }).fill('AB123456');
        await dialog.getByLabel('Phone').fill('+212612345678');
        await dialog.getByLabel('Start date', { exact: true }).fill(monthStart);
        await dialog.getByLabel('Trouser size').fill('42');
        await dialog.getByLabel('Daily salary', { exact: true }).fill('200.25');
        await dialog.getByRole('button', { name: 'Add employee', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await page.getByRole('link', { name: /Youssef El Amrani/ }).first().click();
        await expect(page.getByRole('heading', { name: 'Youssef El Amrani' })).toBeVisible();
        await page.getByRole('button', { name: 'Edit employee', exact: true }).click();
        await dialog.getByLabel('Phone').fill('+212611223344');
        await dialog.getByRole('button', { name: 'Save changes' }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.getByText('+212611223344', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Add advance', exact: true }).click();
        await dialog.getByLabel('Date', { exact: true }).fill(workDate);
        await dialog.getByLabel('Amount', { exact: true }).fill('100.25');
        await dialog.getByLabel('Note', { exact: true }).fill('Travel allowance');
        await dialog.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.getByText('Travel allowance')).toBeVisible();
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        await dialog.getByLabel('Amount', { exact: true }).fill('150.25');
        await dialog.getByRole('button', { name: 'Save changes' }).click();
        await expect(dialog).not.toBeVisible();
        await page.getByRole('button', { name: 'Absences', exact: true }).click();
        await page.getByRole('button', { name: 'Add absence', exact: true }).click();
        await dialog.getByLabel('Date', { exact: true }).fill(workDate);
        await dialog.getByLabel('Days', { exact: true }).selectOption('0.5');
        await dialog.getByLabel('Reason').fill('Personal appointment');
        await dialog.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.getByText('Personal appointment')).toBeVisible();
        await page.getByRole('button', { name: 'Salary history', exact: true }).click();
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        await dialog.getByLabel('Daily salary').fill('220.25');
        await dialog.getByRole('button', { name: 'Save changes' }).click();
        await expect(dialog).not.toBeVisible();
        await page.getByRole('button', { name: 'Payroll', exact: true }).click();
        await expect(page.locator('.statement-sheet')).toBeVisible();
        await expect(page.locator('.statement-sheet')).toContainText('Personal appointment');
        await expect(page.locator('.statement-paid-total')).toContainText('0.00');
        await page.getByRole('button', { name: 'Finalize statement', exact: true }).click();
        await dialog.getByRole('button', { name: 'Finalize statement', exact: true }).click();
        await expect(page).toHaveURL(/\/statements\/\d+$/);
        await expect(page.getByText('PAY-00001').first()).toBeVisible();
        await page.getByRole('button', { name: 'Mark as paid', exact: true }).click();
        await dialog.getByRole('button', { name: 'Mark as paid', exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Mark as paid', exact: true })).not.toBeVisible();
        const paidStatement = await (await page.request.get('/api/statements/1')).json();
        await expect(page.locator('.statement-paid-total strong')).toContainText((paidStatement.total_cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 }));
        await expect(page.locator('.statement-total strong')).toContainText('0.00');
        const denied = await request(page, '/employees/1/advances', 'POST', { date: workDate, amount: '10' });
        expect(denied.status()).toBe(422);
        mkdirSync('artifacts', { recursive: true });
        await page.screenshot({ path: 'artifacts/statement-en.png', fullPage: true });
        await page.pdf({ path: 'artifacts/statement-en.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
        const invalidCsrf = await page.request.post('/api/employees', { data: {}, headers: { 'X-CSRF-TOKEN': 'invalid', Accept: 'application/json' } });
        expect(invalidCsrf.status()).toBe(419);
        await page.locator('.nav-link').filter({ hasText: 'Overview' }).click();
        await expect(page.locator('.stat-accent > strong')).toContainText('0.00');
        await page.screenshot({ path: 'artifacts/dashboard-en.png', fullPage: true });
        expect(errors).toEqual([]);
    });

    test('French and Arabic persist, render RTL on mobile and produce printable PDFs', async ({ page }) => {
        page.on('pageerror', error => errors.push(error.message));
        await login(page);
        await page.getByLabel('Language', { exact: true }).selectOption('fr');
        await expect(page.getByRole('heading', { name: 'Votre équipe, en un coup d’œil' })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Votre équipe, en un coup d’œil' })).toBeVisible();
        await page.getByLabel('Langue', { exact: true }).selectOption('ar');
        await expect(page.getByRole('heading', { name: 'فريقك في لمحة' })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await page.screenshot({ path: 'artifacts/dashboard-ar.png', fullPage: true });
        await page.goto('/statements/1');
        await expect(page.locator('.statement-sheet')).toContainText('كشف الأجر');
        await page.pdf({ path: 'artifacts/statement-ar.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'فريقك في لمحة' })).toBeVisible();
        const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            overflow: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed').map(e => [e.className, e.getBoundingClientRect().width]).slice(0, 12) }));
        expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.width);
        await page.getByRole('button', { name: 'فتح القائمة' }).click();
        await expect(page.locator('.sidebar')).toBeInViewport();
        await page.getByRole('link', { name: 'الموظفون', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'الأشخاص وراء العمل' })).toBeVisible();
        await page.screenshot({ path: 'artifacts/employees-ar-mobile.png', fullPage: true });
        expect(errors).toEqual([]);
    });

    test('period prints subtract multiple paid statements in all languages, including partial overlaps', async ({ page }) => {
        await login(page);
        const result = await request(page, '/employees', 'POST', {
            name: 'Period Payment Employee', employee_number: '998', cin: 'PP998', phone: '+212600000000',
            start_date: '2026-08-01', tshirt_size: 'M', trouser_size: '42', daily_salary: '200',
        });
        expect(result.status()).toBe(201);
        const employee = await result.json();
        expect((await request(page, `/employees/${employee.id}/advances`, 'POST', { date: '2026-08-04', amount: '250' })).status()).toBe(201);
        expect((await request(page, `/employees/${employee.id}/absences`, 'POST', { date: '2026-08-03', days: .5, is_paid: false })).status()).toBe(201);
        for (const [from, to, paid] of [['2026-08-01', '2026-08-06', true], ['2026-08-07', '2026-08-08', true], ['2026-08-10', '2026-08-11', false]]) {
            const response = await request(page, `/employees/${employee.id}/statements`, 'POST', { from, to });
            expect(response.status()).toBe(201);
            if (paid) expect((await request(page, `/statements/${(await response.json()).id}/pay`, 'POST', { paid_on: '2026-08-15' })).status()).toBe(200);
        }
        await page.goto(`/statements/new?employee=${employee.id}`);
        await page.getByLabel('From', { exact: true }).fill('2026-08-01');
        await page.getByLabel('To', { exact: true }).fill('2026-08-12');
        await page.getByRole('button', { name: 'Apply period', exact: true }).click();
        await expect(page.locator('.statement-total strong')).toContainText('600.00');
        await expect(page.locator('.statement-paid-total strong')).toContainText('1,050.00');
        for (const locale of ['en', 'fr', 'ar']) {
            const labels = JSON.parse(readFileSync(`resources/js/locales/${locale}.json`, 'utf8'));
            await page.locator('.language-select').selectOption(locale);
            await expect(page.locator('.statement-paid-total > span')).toHaveText(labels.total_paid_statements);
            await expect(page.locator('.statement-formula')).toHaveText(labels.formula_hint);
            expect(await page.locator('.statement-paid-total').evaluate(row => row.previousElementSibling.querySelector('span').textContent)).toBe(labels.total_advances);
            const money = cents => new Intl.NumberFormat({ en: 'en-GB', fr: 'fr-FR', ar: 'ar-MA' }[locale], { style: 'currency', currency: 'MAD' }).format(cents / 100);
            await expect(page.locator('.statement-paid-total strong')).toHaveText('− ' + money(105000));
            await expect(page.locator('.statement-total strong')).toHaveText(money(60000));
            await page.locator('.statement-daily button').click();
            await expect(page.locator('.daily-table')).toBeVisible();
            await page.emulateMedia({ media: 'print' });
            await expect(page.locator('.statement-paid-total')).toBeVisible();
            await expect(page.locator('.statement-total')).toBeVisible();
            await expect(page.locator('.statement-daily')).not.toBeVisible();
            await page.pdf({ path: `artifacts/paid-period-${locale}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
            if (locale === 'ar') await page.screenshot({ path: 'artifacts/paid-period-ar.png', fullPage: true });
            await page.emulateMedia({ media: 'screen' });
            await page.locator('.statement-daily button').click();
        }
        await page.locator('.language-select').selectOption('en');
        await page.getByLabel('From', { exact: true }).fill('2026-08-05');
        await page.getByLabel('To', { exact: true }).fill('2026-08-07');
        await page.getByRole('button', { name: 'Apply period', exact: true }).click();
        await expect(page.locator('.statement-paid-total strong')).toContainText('600.00');
        await expect(page.locator('.statement-total strong')).toContainText('0.00');
    });

    test('settings, export, encrypted backup and employee deletion', async ({ page }) => {
        await login(page);
        const result = await request(page, '/employees', 'POST', {
            name: 'Temporary Employee', employee_number: '999', cin: 'ZZ999', phone: '+212600000000',
            start_date: monthStart, tshirt_size: 'L', trouser_size: '44', daily_salary: '100',
        });
        expect(result.status()).toBe(201);
        const employee = await result.json();
        await page.goto('/employees');
        await page.getByRole('searchbox').fill('Temporary Employee');
        await expect(page.getByRole('link', { name: /Temporary Employee/ })).toBeVisible();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await expect(page.getByRole('link', { name: /Temporary Employee/ })).not.toBeVisible();
        await page.goto('/settings');
        await page.getByLabel('Company address').fill('Casablanca, Morocco');
        await page.getByRole('button', { name: 'Save changes', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('Changes saved');
        const csvDownload = page.waitForEvent('download');
        await page.locator('.export-options').getByRole('link', { name: 'Employees', exact: true }).click();
        expect((await csvDownload).suggestedFilename()).toMatch(/employees.*\.csv$/);
        const backupDownload = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download backup', exact: true }).click();
        expect((await backupDownload).suggestedFilename()).toMatch(/\.payroll-backup$/);
        await page.getByRole('button', { name: 'Log out', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    });
});
