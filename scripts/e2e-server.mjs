import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const scratch = mkdtempSync(join(tmpdir(), 'srt-payroll-e2e-'));
const database = join(scratch, 'e2e.sqlite');
writeFileSync(database, '');
const env = {
    ...process.env,
    APP_ENV: 'local',
    APP_DEBUG: 'false',
    APP_KEY: 'base64:' + Buffer.alloc(32, 7).toString('base64'),
    APP_URL: 'http://127.0.0.1:8091',
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: database,
    DB_URL: '',
    SESSION_DRIVER: 'database',
    SESSION_COOKIE: 'payroll_e2e_session',
    CACHE_STORE: 'array',
    BCRYPT_ROUNDS: '4',
    LOG_CHANNEL: 'stderr',
};
const migrate = spawnSync('php', ['artisan', 'migrate', '--force', '--no-interaction'], { env, stdio: 'inherit' });
if (migrate.status !== 0) process.exit(migrate.status || 1);
const server = spawn('php', ['artisan', 'serve', '--host=127.0.0.1', '--port=8091', '--no-reload'], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { server.kill(); process.exit(0); });
}
server.on('exit', code => process.exit(code || 0));
process.on('exit', () => {
    server.kill();
    // Only the unique scratch directory created by this test process is removed.
    if (resolve(scratch).startsWith(resolve(tmpdir()) + '\\') || resolve(scratch).startsWith(resolve(tmpdir()) + '/')) {
        try { rmSync(scratch, { recursive: true, force: true }); } catch { /* Windows may still hold the database open until PHP exits. */ }
    }
});
