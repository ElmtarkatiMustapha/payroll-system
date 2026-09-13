import React, { createContext, useContext, useEffect, useState } from 'react';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';
import { setApiLocale } from './api';

const dictionaries = { en, fr, ar };
const Context = createContext();
export function LanguageProvider({ children }) {
    const [locale, setLocaleState] = useState(() => {
        const saved = localStorage.getItem('payroll.locale');
        return dictionaries[saved] ? saved : 'en';
    });
    const setLocale = value => { if (dictionaries[value]) { setApiLocale(value); localStorage.setItem('payroll.locale', value); setLocaleState(value); } };
    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        setApiLocale(locale);
    }, [locale]);
    const t = key => dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
    const formatLocale = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-MA' }[locale];
    const money = (cents, currency = 'MAD') => new Intl.NumberFormat(formatLocale, { style: 'currency', currency }).format(Number(cents || 0) / 100);
    const date = value => value ? new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value.slice(0, 10) + 'T12:00:00')) : '—';
    const number = value => new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 2 }).format(value || 0);
    return <Context.Provider value={{ locale, setLocale, t, money, date, number }}>{children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);
export function LanguageSelect() {
    const { locale, setLocale, t } = useI18n();
    return <select className="language-select" aria-label={t('language')} value={locale} onChange={event => setLocale(event.target.value)}>
        <option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option>
    </select>;
}
