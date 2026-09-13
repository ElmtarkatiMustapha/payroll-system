import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const channel = process.env.PLAYWRIGHT_CHANNEL || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);

export default defineConfig({
    testDir: './tests/browser',
    timeout: 180000,
    expect: { timeout: 30000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:8091',
        headless: true,
        channel,
        viewport: { width: 1440, height: 1000 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'node scripts/e2e-server.mjs',
        url: 'http://127.0.0.1:8091/up',
        reuseExistingServer: false,
        timeout: 60000,
    },
});
