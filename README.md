# SRT Payroll

Daily payroll management with a Laravel 13 backend, React 19 frontend, Tailwind CSS, Vite, and MySQL. The complete interface, business validation, CSV exports, and printable statements are available in **English, French, and Arabic**. Arabic uses a right-to-left layout and a bundled Arabic font.

## Start with Docker

Install and start Docker Desktop using Linux containers. Run these commands from this project folder.

**Windows / PowerShell**

```powershell
.\scripts\setup.ps1
```

**Linux / macOS**

```sh
sh scripts/setup.sh
```

Open **http://localhost:8080**. The first visit asks you to create your company and administrator account. Public registration closes after that account is created. There are no predefined login credentials or sample employees.

The setup script creates missing application/database secrets in .env, builds assets and containers, runs database migrations, and starts:

| Service | Purpose |
| --- | --- |
| nginx | Web server, available on localhost:8080 |
| app | PHP 8.4 with PHP-FPM and Laravel |
| mysql | MySQL 8.4 with persistent storage |
| scheduler | Daily encrypted backups at 02:00 Africa/Casablanca |

Only Nginx is exposed to the host; MySQL remains on Docker's internal network. Database and backup files survive container restarts and image rebuilds.

Set APP_PORT in .env to use a different port. The default currency is MAD and the working week is Monday–Saturday; both are configurable in Settings. Choose the currency before creating employees, since changing the currency of recorded money would require an explicit conversion.

```sh
docker compose up -d                 # Start existing containers
docker compose stop                  # Stop while keeping all data
docker compose logs --tail=100 app    # Application logs
docker compose up -d --build          # Rebuild after source changes
docker compose exec app php artisan migrate --force
```

## Included features

- First-run administrator setup, rate-limited login, logout, password changes, session cookies, and CSRF protection.
- Employee creation and editing; user-entered numeric employee numbers preserve leading zeros. CIN and employee number are unique.
- Name, CIN, phone, start/end dates, T-shirt size, trouser size, notes, and archive status.
- Reactivation with a return-to-work date and preserved employment periods; archived gaps earn no salary.
- Search, status filters, pagination, and a dashboard for a selected payroll period.
- Dated salary history: edit daily rates and add future effective rates.
- Advance payments with date, exact decimal amount, and optional note; create, edit, and delete.
- Paid/unpaid absences, full days or half-days, optional reasons; create, edit, and delete.
- Payroll previews for any inclusive period up to 366 days.
- An employee payroll calendar: red unfinalized dates, yellow finalized/unpaid dates, green paid dates, and grey future/out-of-employment dates. Labels and icons accompany the colours.
- Finalized statements, recorded payment dates, prevention of overlapping settlements, and immutable payroll snapshots.
- A4 printing and PDF creation through the browser's **Print / Save PDF** button. Choose **Save as PDF** in the print dialog. Arabic text is shaped by the browser and fonts are bundled locally.
- Localized CSV exports compatible with Excel, including UTF-8 BOM and spreadsheet-formula protection.
- Manual encrypted backup downloads and automatic daily backups.
- Responsive desktop and mobile screens; persisted language preference.

## Payroll rules

For each scheduled date inside one of the employee's employment periods, use the latest salary rate effective on that date.

```text
Base salary       = sum of each scheduled day's rate
Absence deduction = sum of each unpaid absence's daily rate × absence fraction
Net earnings      = base salary − absence deductions − advances dated in the period
Remaining pay     = net earnings − amounts already settled for days in the period
```

Dates are inclusive. Weekends are determined by the configured working week. Paid absences reduce the number of days worked but do not reduce pay. Off-calendar days do not accrue pay or accept absence entries. Advances dated on a non-working day still count in their payment period.

Money is stored as integer hundredths; inputs accept up to two decimal places. A half-day deduction containing half a cent is rounded up to the next cent. Balances may be negative and are preserved exactly. A negative statement cannot be marked as a cash payment. Advances and negative balances do not automatically carry into another period.

Finalizing a statement records employee/company information, daily calculations, advances, and absences. It locks financial edits within its dates and prevents changes to salary rates that would affect it. Finalized statements cannot be edited or deleted; check the preview before finalizing. The payment status and payment date can be recorded once. A payment date must be between the period end and today.

Historical dashboard totals reuse finalized daily snapshots, including their original working calendar. Dashboard settlement totals are attributed to the earned period, rather than a cash-flow report of payment dates.

Payroll previews and printed statements show **Total paid payroll statements** immediately after total advances and subtract it from remaining pay. Only statements marked paid count. A fully included paid period contributes its net payment after its advances and absence deductions; partial overlaps contribute only the net earnings for the overlapping dates. Unpaid finalized statements are not deducted. Opening a paid statement itself shows its recorded payment and zero remaining pay while retaining its original stored snapshot. Daily breakdowns remain available on screen and are omitted from printing/PDF output.

Open an employee's **Payroll calendar** tab or **Payroll → Select unpaid days**. Select the first and last red dates, then preview and finalize. Single-day periods and selections across months are supported. A range cannot cross green paid dates or mix red dates with yellow finalized dates. Selecting a yellow day selects its whole existing statement; **Open unpaid statement** opens it for payment without creating another statement. Paid dates are disabled, and future dates or dates outside employment cannot be used for new statements. The server also rejects overlapping, future, and out-of-employment finalizations. Non-working days have a dot and retain the status of their calendar date; finalized dates use the saved working calendar.

Use **Period report** to print a summary over arbitrary dates that includes prior payments. Reports do not create new statements. Finalized and paid receipts remain accessible in the statement list.

Employees with payroll records or multiple employment periods are archived instead of permanently deleted. Archiving closes the current employment period on the chosen last working date and preserves earlier periods. Choose **Reactivate employee** and enter a **Return-to-work date** after the previous end date and no later than today. This creates a new employment period, restores Active status, and resumes salary on scheduled working days starting on the return date. The original employee number, CIN, original start date, salary history, entries, and finalized snapshots remain intact. Repeated departures and returns are supported; time between periods is never counted as working days or absence days and cannot receive new advances, absences, or salary rates. New payroll statements cannot cross those gaps, while period reports can span them and count only employment days.

Employment periods appear on the employee profile after reactivation. The current salary history continues to apply; use Salary history to record a different rate effective on the return date if needed. A return on a non-working day resumes employment that day but salary starts on the next scheduled working day. Direct employment-date editing is locked after archiving, reactivation, or finalizing payroll. Employees reactivated in older versions who still have a past end date can also use Reactivate employee to record their actual return.

The employment-period migration copies existing employees' start/end dates into their first period, including archived employees, without changing their existing payroll. New encrypted backups use format v2 and include all employment periods. The updated app also accepts v1 backups and reconstructs their original single employment period from each employee's saved dates.

This version implements the agreed daily-pay/absence/advance rules. Tax withholding, statutory contributions, overtime, public-holiday calendars, and automatic carry-forward are not configured.

## Backups and restoration

Backups include administrator accounts, company settings, employees, salary rates, advances, absences, and statements. They are compressed and encrypted using Laravel's APP_KEY. They exclude active sessions and cache entries.

Download one from **Settings → Backups & exports**, or run:

```sh
docker compose exec app php artisan payroll:backup
```

Automatic backups are stored in the persistent payroll-storage volume under /var/www/html/storage/app/private/backups. Keep copies outside this machine and retain a secure copy of .env: **the original APP_KEY is required to decrypt backups**. Do not regenerate it during routine updates. Retention is manual.

To restore a downloaded backup:

```sh
docker compose cp ./your-backup.payroll-backup app:/tmp/restore.payroll-backup
docker compose exec app php artisan payroll:restore /tmp/restore.payroll-backup
```

The command validates and decrypts the backup before asking you to confirm replacement of current payroll data and administrator accounts. Restoration is transactional and signs out existing sessions. Restore into an app using the original APP_KEY and matching schema version.

## Local development with MySQL

Requirements: PHP 8.3 or newer, Composer 2, Node.js 22.12 or newer, and a local MySQL database. PHP needs PDO MySQL, mbstring, XML/DOM, ctype, curl, fileinfo, intl, and zip. SQLite is used only for isolated automated tests.

1. Copy .env.example to .env if the file does not exist.
2. Create a MySQL database and set DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, and DB_PASSWORD in .env.
3. Set APP_ENV=local and APP_URL=http://localhost:8000.
4. Install and start:

```sh
composer install
php artisan key:generate              # Only on a new installation with an empty APP_KEY
php artisan migrate
npm ci
npm run build
php artisan serve
```

For live frontend updates, run npm run dev in another terminal. For automatic local backups, also run php artisan schedule:work. For a local Nginx setup, use public/ as the document root and adapt docker/nginx.conf to your PHP-FPM address.

React uses Laravel's authenticated JSON endpoints on the same origin. Business calculations and validation run on the server. There are no external CDNs, authentication services, or translation API dependencies.

## Verification

```sh
php artisan test
node --test tests/calendar.test.mjs
npm run check:translations
npm run build
npm run test:e2e
```

Browser tests use an isolated temporary SQLite database, start a test server on port 8091, and use installed Google Chrome on Windows when available. On other systems, run npx playwright install chromium first, or set PLAYWRIGHT_CHANNEL to chrome or msedge. They never use the configured production database.

Tests cover payroll arithmetic, salary history, half-day rounding, paid leave, employment boundaries, invalid/duplicate entries, nested employee record ownership, finalized period protection, payments, negative balances, archive/deletion rules, encrypted backup restoration, localized CSV export, authentication, CSRF, language persistence, mobile RTL, and print/PDF output.

Generated browser screenshots and sample PDFs are placed in artifacts/. They contain test data only.

Laravel/PHP compatibility: https://laravel.com/framework/docs/releases
