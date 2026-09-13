let token = document.querySelector('meta[name="csrf-token"]')?.content;
let locale = localStorage.getItem('payroll.locale') || 'en';
export function setApiLocale(value) { locale = value; }
export function setToken(value) { if (value) token = value; }
export async function api(path, options = {}) {
    const { body, ...rest } = options;
    const response = await fetch('/api' + path, {
        credentials: 'same-origin',
        ...rest,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token || '', 'X-Locale': locale, ...rest.headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || 'Request failed');
        error.errors = data.errors || {};
        error.status = response.status;
        if (response.status === 401 || response.status === 419) window.dispatchEvent(new Event('session-expired'));
        throw error;
    }
    setToken(data.csrf_token);
    return data;
}
export async function downloadBackup() {
    const response = await fetch('/api/backup', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/octet-stream', 'X-CSRF-TOKEN': token || '', 'X-Locale': locale } });
    if (!response.ok) { const error = new Error('Backup failed'); error.status = response.status; throw error; }
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a');
    a.href = url; a.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'workspace.payroll-backup';
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const localDate = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
export const today = () => localDate();
export const monthStart = () => { const d = new Date(); d.setDate(1); return localDate(d); };
