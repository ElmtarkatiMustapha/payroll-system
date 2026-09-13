import React from 'react';
import { api, today } from '../lib/api';
import { useApp, useForm } from '../lib/context';
import { useI18n } from '../lib/i18n';
import { Button, Field, FormError, Modal } from './ui';
import { employmentPeriods, shiftDate } from '../lib/payroll-calendar';

export function EmployeeForm({ employee, onClose, onSaved }) {
    const { t } = useI18n(); const { notify, refresh } = useApp();
    const datesLocked = employee && (employee.archived_at || employee.statements?.length || employmentPeriods(employee).length > 1);
    const form = useForm(employee ? { ...employee, end_date: employee.end_date || '', notes: employee.notes || '' } : {
        name: '', employee_number: '', cin: '', phone: '', start_date: today(), end_date: '', tshirt_size: 'M', trouser_size: '', daily_salary: '', notes: '',
    });
    const field = (key, type = 'text', extra = {}) => <Field label={t(key)} error={form.errors[key]} type={type} value={form.values[key] || ''} onChange={e => form.set(key, e.target.value)} {...extra} />;
    return <Modal title={t(employee ? 'edit_employee' : 'add_employee')} wide onClose={onClose}>
        <form onSubmit={event => form.submit(event, async values => {
            const result = await api('/employees' + (employee ? '/' + employee.id : ''), { method: employee ? 'PUT' : 'POST', body: { ...values, end_date: values.end_date || null } });
            notify(t('saved')); refresh(); onSaved?.(result); onClose();
        })}><div className="modal-body"><FormError errors={form.errors} /><div className="form-section-title">{t('personal_info')}</div>
            <div className="form-grid">{field('name', 'text', { required: true, autoFocus: true, maxLength: 255 })}{field('employee_number', 'text', { required: true, inputMode: 'numeric', pattern: '[0-9]+', maxLength: 30 })}{field('cin', 'text', { required: true, maxLength: 30 })}{field('phone', 'tel', { required: true, maxLength: 40 })}</div>
            <div className="form-section-title">{t('employment')}</div><div className="form-grid">
                {field('start_date', 'date', { required: true, disabled: !!datesLocked })}{field('end_date', 'date', { min: form.values.start_date, hint: t('optional'), disabled: !!datesLocked })}
                <Field label={t('tshirt_size')}><select value={form.values.tshirt_size} onChange={e => form.set('tshirt_size', e.target.value)}>{['XS','S','M','L','XL','XXL','3XL','4XL'].map(size => <option key={size}>{size}</option>)}</select></Field>
                {field('trouser_size', 'text', { required: true, maxLength: 10 })}
                {!employee && field('daily_salary', 'number', { required: true, min: '0.01', max: '1000000', step: '0.01' })}
            </div><Field label={t('notes')} hint={t('optional')}><textarea rows={3} value={form.values.notes} maxLength={2000} onChange={e => form.set('notes', e.target.value)} /></Field>
            {datesLocked && <p className="form-hint">{t('employment_locked')}</p>}{employee && <p className="form-hint">{t('salary_history_hint')}</p>}
        </div><div className="modal-footer"><Button variant="secondary" type="button" onClick={onClose}>{t('cancel')}</Button><Button type="submit" busy={form.busy}>{t(employee ? 'save' : 'add_employee')}</Button></div></form>
    </Modal>;
}

export function EntryForm({ type, entry, employeeId, employees = [], onClose }) {
    const { t } = useI18n(); const { refresh, notify } = useApp();
    const isSalary = type === 'salary-rates'; const isAdvance = type === 'advances';
    const form = useForm(entry ? { ...entry, employee_id: employeeId || entry.employee_id, amount: (entry.amount_cents / 100).toFixed(2), daily_salary: (entry.rate_cents / 100).toFixed(2), note: entry.note || '', reason: entry.reason || '', is_paid: Boolean(Number(entry.is_paid)) } : {
        employee_id: employeeId || '', date: today(), effective_date: today(), amount: '', daily_salary: '', note: '', reason: '', days: '1', is_paid: false,
    });
    const titleKey = (entry ? 'edit_' : 'add_') + (isSalary ? 'salary' : isAdvance ? 'advance' : 'absence');
    return <Modal title={t(titleKey)} onClose={onClose}><form onSubmit={event => form.submit(event, async values => {
        await api('/employees/' + values.employee_id + '/' + type + (entry ? '/' + entry.id : ''), { method: entry ? 'PUT' : 'POST', body: values });
        refresh(); notify(t('saved')); onClose();
    })}><div className="modal-body"><FormError errors={form.errors} />
        {!employeeId && <Field label={t('employee')}><select required value={form.values.employee_id} onChange={e => form.set('employee_id', e.target.value)} disabled={!!entry}><option value="">{t('select_employee')}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} · #{e.employee_number}</option>)}</select></Field>}
        <Field label={t(isSalary ? 'effective_date' : 'date')} type="date" required max={isAdvance ? today() : undefined} value={form.values[isSalary ? 'effective_date' : 'date']} onChange={e => form.set(isSalary ? 'effective_date' : 'date', e.target.value)} />
        {(isSalary || isAdvance) ? <Field label={t(isSalary ? 'daily_salary' : 'amount')} type="number" min="0.01" step="0.01" max="1000000" required value={form.values[isSalary ? 'daily_salary' : 'amount']} onChange={e => form.set(isSalary ? 'daily_salary' : 'amount', e.target.value)} /> : <>
            <Field label={t('days')}><select value={form.values.days} onChange={e => form.set('days', e.target.value)}><option value="1">{t('full_day')}</option><option value="0.5">{t('half_day')}</option></select></Field>
            <label className="checkbox-label"><input type="checkbox" checked={form.values.is_paid} onChange={e => form.set('is_paid', e.target.checked)} />{t('is_paid')}</label>
        </>}
        {!isSalary && <Field label={t(isAdvance ? 'note' : 'reason')} hint={t('optional')}><textarea rows={3} maxLength={1000} value={form.values[isAdvance ? 'note' : 'reason']} onChange={e => form.set(isAdvance ? 'note' : 'reason', e.target.value)} /></Field>}
        {isSalary && <p className="form-hint">{t('salary_history_hint')}</p>}
    </div><div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button type="submit" busy={form.busy}>{t(entry ? 'save' : 'add')}</Button></div></form></Modal>;
}

export function ArchiveForm({ employee, onClose }) {
    const { t } = useI18n(); const { refresh, notify } = useApp();
    const returning = !!employee.archived_at || (employee.end_date && employee.end_date < today());
    const current = employmentPeriods(employee).at(-1);
    const form = useForm({ end_date: employee.end_date || today(), return_date: today() });
    return <Modal title={t(returning ? 'restore' : 'archive')} onClose={onClose}><form onSubmit={event => form.submit(event, async values => {
        await api('/employees/' + employee.id + '/archive', { method: 'PATCH', body: returning ? { archived: false, return_date: values.return_date } : { archived: true, end_date: values.end_date } });
        refresh(); notify(t('saved')); onClose();
    })}><div className="modal-body"><p className="muted">{t(returning ? 'unarchive_hint' : 'archive_hint')}</p><FormError errors={form.errors} />{returning ? <Field label={t('return_date')} type="date" required min={current.end_date ? shiftDate(current.end_date, 1) : undefined} max={today()} value={form.values.return_date} onChange={e => form.set('return_date', e.target.value)} /> : <Field label={t('end_date')} type="date" required min={current.start_date} value={form.values.end_date} onChange={e => form.set('end_date', e.target.value)} />}</div>
        <div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button busy={form.busy} type="submit">{t(returning ? 'restore' : 'archive')}</Button></div></form></Modal>;
}
