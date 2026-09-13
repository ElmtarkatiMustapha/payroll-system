import React, { useId, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Check, Clock3, CircleDashed, LockKeyhole } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { today } from '../lib/api';
import { calendarDate, isoDate, payrollDay, payrollSelection, shiftDate } from '../lib/payroll-calendar';
import { Button, IconButton } from './ui';

const statusIcons = { unfinalized: CircleDashed, finalized: Clock3, paid: Check, unavailable: LockKeyhole };
const statusKeys = { unfinalized: 'calendar_unfinalized', finalized: 'calendar_finalized', paid: 'paid', unavailable: 'calendar_unavailable' };

export default function PayrollCalendar({ employee, workingDays, initialPeriod, onPreview, onOpenStatement, onChange }) {
    const { t, date, number, locale } = useI18n();
    const id = useId(); const cutoff = today();
    const lastDate = employee.end_date && employee.end_date < cutoff ? employee.end_date : cutoff;
    const initialDate = initialPeriod?.from && /^\d{4}-\d{2}-\d{2}$/.test(initialPeriod.from) && Number.isFinite(+calendarDate(initialPeriod.from))
        ? initialPeriod.from : (employee.start_date > lastDate ? employee.start_date : lastDate);
    const [month, setMonth] = useState(initialDate.slice(0, 7));
    const [range, setRange] = useState(initialPeriod || { from: '', to: '' });
    const [anchor, setAnchor] = useState(null);
    const selection = payrollSelection(employee, range, cutoff);
    const formatLocale = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-MA' }[locale];
    const first = month + '-01'; const firstDate = calendarDate(first);
    const monthTitle = new Intl.DateTimeFormat(formatLocale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(firstDate);
    const offset = (firstDate.getUTCDay() + 6) % 7;
    const nextMonth = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + 1, 1, 12));
    const count = (nextMonth - firstDate) / 86400000;
    const updateRange = value => { setRange(value); onChange?.(); };
    const moveMonth = offset => {
        const value = calendarDate(first); value.setUTCMonth(value.getUTCMonth() + offset); setMonth(isoDate(value).slice(0, 7));
    };
    const choose = key => {
        const day = payrollDay(employee, key, cutoff);
        if (day.status === 'paid' || day.status === 'unavailable') return;
        if (day.statement) {
            setAnchor(null); updateRange({ from: day.statement.from, to: day.statement.to }); return;
        }
        if (!anchor) { setAnchor(key); updateRange({ from: key, to: key }); }
        else { updateRange({ from: key < anchor ? key : anchor, to: key > anchor ? key : anchor }); setAnchor(null); }
    };

    return <section className="payroll-calendar card no-print" aria-labelledby={id + '-title'}>
        <div className="calendar-heading"><div><h2 id={id + '-title'}><CalendarDays size={19} />{t('payroll_calendar')}</h2><p>{t('calendar_hint')}</p></div></div>
        <div className="calendar-legend">{Object.entries(statusIcons).map(([status, Icon]) => <span key={status}><i className={'calendar-key calendar-' + status}><Icon size={13} /></i>{t(statusKeys[status])}</span>)}</div>
        <div className="calendar-layout"><div className="calendar-month">
            <div className="calendar-month-heading"><h3 aria-live="polite">{monthTitle}</h3><div><IconButton icon={ChevronLeft} label={t('calendar_previous_month')} onClick={() => moveMonth(-1)} />
                <input type="month" aria-label={t('calendar_month')} value={month} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }} />
                <IconButton icon={ChevronRight} label={t('calendar_next_month')} onClick={() => moveMonth(1)} /></div></div>
            <div className="calendar-grid" role="group" aria-label={monthTitle}>
                {Array.from({ length: 7 }, (_, index) => <span className="calendar-weekday" key={'weekday-' + index}>{new Intl.DateTimeFormat(formatLocale, { weekday: 'short', timeZone: 'UTC' }).format(calendarDate(shiftDate('2026-08-03', index)))}</span>)}
                {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} aria-hidden="true" />)}
                {Array.from({ length: count }, (_, index) => {
                    const key = shiftDate(first, index); const day = payrollDay(employee, key, cutoff); const Icon = statusIcons[day.status];
                    const dayOfWeek = calendarDate(key).getUTCDay() || 7;
                    const scheduled = day.statement ? day.statement.snapshot.daily_breakdown.find(d => d.date === key)?.scheduled_days : workingDays.includes(dayOfWeek);
                    const offDay = day.status !== 'unavailable' && !scheduled;
                    const selected = !selection.error && key >= range.from && key <= range.to;
                    const label = [date(key), t(statusKeys[day.status]), offDay ? t('calendar_day_off') : null,
                        day.statement ? 'PAY-' + String(day.statement.id).padStart(5, '0') : null].filter(Boolean).join(' · ');
                    return <button type="button" key={key} data-date={key} data-status={day.status} className={'calendar-day calendar-' + day.status + (selected ? ' is-selected' : '') + (offDay ? ' is-day-off' : '')}
                        disabled={['paid', 'unavailable'].includes(day.status)} aria-label={label} title={label} aria-pressed={selected} aria-current={key === cutoff ? 'date' : undefined} onClick={() => choose(key)}>
                        <span>{number(index + 1)}</span><Icon size={14} aria-hidden="true" />{offDay && <i aria-hidden="true" />}
                    </button>;
                })}
            </div><p className="calendar-week-note">{t('calendar_week_note')}</p>
        </div><form className="calendar-selection" onSubmit={event => {
            event.preventDefault(); if (selection.error) return;
            if (selection.statement) onOpenStatement(selection.statement.id); else onPreview(range);
        }}>
            <h3>{t('calendar_selected_period')}</h3>
            <p className="muted">{anchor ? t('calendar_choose_end') : t('calendar_selection_hint')}</p>
            <label htmlFor={id + '-from'}>{t('from')}</label><input id={id + '-from'} type="date" required min={employee.start_date} max={lastDate} value={range.from} onChange={event => { setAnchor(null); updateRange({ ...range, from: event.target.value }); }} />
            <label htmlFor={id + '-to'}>{t('to')}</label><input id={id + '-to'} type="date" required min={range.from || employee.start_date} max={lastDate} value={range.to} onChange={event => { setAnchor(null); updateRange({ ...range, to: event.target.value }); }} />
            <div className="calendar-feedback" aria-live="polite">{range.from && range.to && selection.error ? <p className="calendar-error" role="alert">{t(selection.error)}</p> : selection.statement ? <p className="calendar-existing">{t('calendar_existing_hint')}<strong>PAY-{String(selection.statement.id).padStart(5, '0')}</strong><span>{date(range.from)} — {date(range.to)}</span></p> : <p className="muted">{t('calendar_no_paid_days')}</p>}</div>
            <Button type="submit" icon={selection.statement ? Clock3 : CalendarDays} disabled={!!selection.error}>{t(selection.statement ? 'calendar_open_statement' : 'preview')}</Button>
            {(range.from || range.to) && <button type="button" className="text-button" onClick={() => { setAnchor(null); updateRange({ from: '', to: '' }); }}>{t('calendar_clear')}</button>}
        </form></div>
    </section>;
}
