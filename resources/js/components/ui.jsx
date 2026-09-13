import React, { useEffect, useId, useRef, useState } from 'react';
import { Search, X, Plus, ArrowRight, ChevronLeft, ChevronRight, Inbox, LoaderCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApp } from '../lib/context';
import { monthStart, today } from '../lib/api';

export function Button({ children, icon: Icon, variant = 'primary', className = '', busy, ...props }) {
    return <button className={'btn btn-' + variant + ' ' + className} {...props} disabled={busy || props.disabled}>
        {busy ? <LoaderCircle size={16} className="spin" /> : Icon && <Icon size={16} />}{children}
    </button>;
}
export function IconButton({ icon: Icon, label, ...props }) { return <button type="button" className="icon-button" aria-label={label} title={label} {...props}><Icon size={16} /></button>; }
export function Field({ label, error, children, className = '', hint, ...props }) {
    const id = useId();
    return <div className={'field ' + className}><label htmlFor={id}>{label}</label>
        {children ? React.cloneElement(children, { id, 'aria-invalid': !!error, 'aria-describedby': error ? id + '-error' : undefined }) : <input id={id} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined} {...props} />}
        {hint && <small>{hint}</small>}{error && <span id={id + '-error'} className="field-error">{error}</span>}
    </div>;
}
export function FormError({ errors }) {
    const messages = Object.values(errors).filter(Boolean);
    return messages.length > 0 && <div role="alert" className="form-error"><AlertCircle size={17} /><div>{messages.map((message, i) => <p key={i}>{message}</p>)}</div></div>;
}
export function Modal({ title, onClose, children, wide = false }) {
    const ref = useRef(); const titleId = useId();
    useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
    return <dialog ref={ref} aria-labelledby={titleId} className={'modal ' + (wide ? 'modal-wide' : '')}
        onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) onClose(); }}>
        <div className="modal-heading"><h2 id={titleId}>{title}</h2><IconButton icon={X} label={useI18n().t('close')} onClick={onClose} /></div>
        {children}
    </dialog>;
}
export function Confirm({ title, body, onClose, onConfirm, danger = false, label, children }) {
    const { t } = useI18n(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    return <Modal title={title} onClose={onClose}><div className="modal-body"><p className="muted">{body}</p>{children}{error && <div className="form-error" role="alert">{error}</div>}</div>
        <div className="modal-footer"><Button variant="secondary" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
            <Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={async () => {
                setBusy(true); try { await onConfirm(); onClose(); } catch (e) { setError(Object.values(e.errors || {}).flat().join(' ') || t('error')); } finally { setBusy(false); }
            }}>{label || t('save')}</Button></div></Modal>;
}
export function PageHeading({ eyebrow, title, description, children }) {
    return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div><div className="heading-actions">{children}</div></div>;
}
export function Empty({ title, body, children, icon: Icon = Inbox }) { const { t } = useI18n(); return <div className="empty-state"><div className="empty-icon"><Icon size={25} /></div><h3>{title || t('empty_records')}</h3><p>{body || t('empty_records_body')}</p>{children}</div>; }
export function Loading() { const { t } = useI18n(); return <div className="loading-state" role="status"><LoaderCircle className="spin" size={24} />{t('loading')}</div>; }
export function LoadError({ error }) { const { t } = useI18n(); const { refresh } = useApp(); return <div className="error-state" role="alert"><AlertCircle /><p>{error?.status === 404 ? t('not_found') : Object.values(error?.errors || {}).flat().join(' ') || t('error')}</p><Button variant="secondary" onClick={refresh}>{t('retry')}</Button></div>; }
export function Badge({ status }) { const { t } = useI18n(); return <span className={'badge badge-' + status}><span />{t(status)}</span>; }
export function Avatar({ name = '', large = false }) { return <div className={'avatar ' + (large ? 'avatar-large' : '')}>{name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</div>; }
export function SearchInput({ value, onChange }) { const { t } = useI18n(); return <div className="search-input"><Search size={17} /><input type="search" aria-label={t('search')} placeholder={t('search')} value={value} onChange={e => onChange(e.target.value)} /></div>; }
export function PeriodPicker() {
    const { t } = useI18n(); const { period, setPeriod } = useApp(); const [draft, setDraft] = useState(period);
    useEffect(() => setDraft(period), [period.from, period.to]);
    return <form className="period-picker" onSubmit={event => { event.preventDefault(); setPeriod(draft); }}>
        <label><span>{t('from')}</span><input aria-label={t('from')} type="date" required value={draft.from} max={draft.to} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
        <span className="period-arrow">—</span><label><span>{t('to')}</span><input aria-label={t('to')} type="date" required value={draft.to} min={draft.from} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
        <Button variant="secondary" type="submit" icon={ArrowRight}>{t('apply')}</Button>
        <button className="text-button" type="button" onClick={() => setPeriod({ from: monthStart(), to: today() })}>{t('this_month')}</button>
    </form>;
}
export function Pagination({ count, page, setPage, size = 10 }) {
    const { t, number } = useI18n(); const pages = Math.max(1, Math.ceil(count / size));
    return <div className="pagination"><span>{number(count)} {t('results')}</span><div><IconButton icon={ChevronLeft} label={t('previous')} disabled={page <= 1} onClick={() => setPage(page - 1)} /><span>{t('page')} {number(page)} {t('of')} {number(pages)}</span><IconButton icon={ChevronRight} label={t('next')} disabled={page >= pages} onClick={() => setPage(page + 1)} /></div></div>;
}
export function StatCard({ label, value, icon: Icon, foot, accent = false }) { return <div className={'stat-card ' + (accent ? 'stat-accent' : '')}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18} /></div></div><strong>{value}</strong>{foot && <small>{foot}</small>}</div>; }
export const periodQuery = period => new URLSearchParams(period).toString();
export function ExportLink({ type, children }) { const { period } = useApp(); const { locale, t } = useI18n(); return <a className="btn btn-secondary" href={'/api/export/' + type + '?' + periodQuery(period) + '&locale=' + locale}>{children || t('export')}</a>; }
