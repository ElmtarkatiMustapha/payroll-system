import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, monthStart, today } from './api';
import { useI18n } from './i18n';

const Context = createContext();
export function AppProvider({ children }) {
    const { t, setLocale } = useI18n();
    const [session, setSession] = useState(null);
    const [bootError, setBootError] = useState(null);
    const [period, setPeriod] = useState({ from: monthStart(), to: today() });
    const [version, setVersion] = useState(0);
    const [toast, setToast] = useState(null);
    const refresh = useCallback(() => setVersion(value => value + 1), []);
    const notify = useCallback((message, kind = 'success') => setToast({ message, kind }), []);
    const boot = useCallback(() => {
        setBootError(null);
        api('/session').then(data => {
            setSession(data);
            if (!localStorage.getItem('payroll.locale')) setLocale(data.settings.locale || 'en');
        }).catch(setBootError);
    }, []);
    useEffect(boot, [boot]);
    useEffect(() => {
        const handler = () => { setSession(value => value ? { ...value, user: null } : value); notify(t('session_expired'), 'error'); };
        window.addEventListener('session-expired', handler);
        return () => window.removeEventListener('session-expired', handler);
    }, [t]);
    useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timer); } }, [toast]);
    return <Context.Provider value={{ session, setSession, bootError, boot, period, setPeriod, version, refresh, notify }}>
        {children}
        {toast && <div className={'toast ' + toast.kind} role="status">{toast.message}<button aria-label={t('close')} onClick={() => setToast(null)}>×</button></div>}
    </Context.Provider>;
}
export const useApp = () => useContext(Context);
export function useLoad(path) {
    const { version } = useApp();
    const [state, setState] = useState({ data: null, error: null, loading: true });
    useEffect(() => {
        if (!path) { setState({ data: null, error: null, loading: false }); return; }
        const controller = new AbortController();
        setState(value => ({ ...value, error: null, loading: true }));
        api(path, { signal: controller.signal }).then(data => setState({ data, error: null, loading: false })).catch(error => {
            if (error.name !== 'AbortError') setState({ data: null, error, loading: false });
        });
        return () => controller.abort();
    }, [path, version]);
    return state;
}
export function useForm(initial = {}) {
    const [values, setValues] = useState(initial);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const { t } = useI18n();
    const set = (key, value) => { setValues(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: null, form: null })); };
    const submit = async (event, action) => {
        event?.preventDefault();
        if (busy) return;
        setBusy(true); setErrors({});
        try { await action(values); } catch (error) {
            setErrors(Object.keys(error.errors || {}).length
                ? Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key, messages[0]]))
                : { form: t(error.status === 429 ? 'too_many_requests' : error.status === 419 || error.status === 401 ? 'session_expired' : 'error') });
        } finally { setBusy(false); }
    };
    return { values, setValues, errors, busy, set, submit };
}
