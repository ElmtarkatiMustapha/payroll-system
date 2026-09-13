import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, CalendarDays, ArrowUpRight } from 'lucide-react';
import { useApp, useLoad } from '../lib/context';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { PageHeading, Button, PeriodPicker, Loading, LoadError, ExportLink, periodQuery, SearchInput, Empty, IconButton, Confirm, Pagination, Avatar } from '../components/ui';
import { EntryForm } from '../components/Forms';

export function EntryTable({ type, entries, employeeId, employees, compact = false }) {
    const { t, money, date, number } = useI18n(); const { session, refresh, notify } = useApp();
    const [edit, setEdit] = useState(null); const [remove, setRemove] = useState(null); const [page, setPage] = useState(1);
    const isAdvance = type === 'advances', isSalary = type === 'salary-rates';
    useEffect(() => setPage(p => Math.min(p, Math.max(1, Math.ceil(entries.length / 10)))), [entries.length]);
    const shown = entries.slice((page - 1) * 10, page * 10);
    return <>{!entries.length ? <Empty /> : <><div className="table-scroll"><table><thead><tr>{!employeeId && <th>{t('employee')}</th>}<th>{t(isSalary ? 'effective_date' : 'date')}</th><th>{t(isSalary ? 'daily_salary' : isAdvance ? 'amount' : 'days')}</th>{!isSalary && <th>{t(isAdvance ? 'note' : 'reason')}</th>}{!isSalary && !isAdvance && <th>{t('is_paid')}</th>}<th><span className="sr-only">{t('actions')}</span></th></tr></thead><tbody>{shown.map(entry => <tr key={entry.id}>
        {!employeeId && <td><Link className="person-cell" to={'/employees/' + entry.employee_id}><Avatar name={entry.name} /><span><strong>{entry.name}</strong><small>#{entry.employee_number}</small></span></Link></td>}
        <td>{date(entry[isSalary ? 'effective_date' : 'date'])}</td><td className="money-cell">{isSalary || isAdvance ? money(entry[isSalary ? 'rate_cents' : 'amount_cents'], session.settings.currency) : number(entry.days)}</td>
        {!isSalary && <td><span className="cell-note">{entry[isAdvance ? 'note' : 'reason'] || '—'}</span></td>}{!isSalary && !isAdvance && <td><span className={'soft-label ' + (Number(entry.is_paid) ? 'soft-green' : '')}>{t(Number(entry.is_paid) ? 'paid_leave' : 'unpaid_leave')}</span></td>}
        <td><div className="row-actions"><IconButton icon={Pencil} label={t('edit')} onClick={() => setEdit(entry)} /><IconButton icon={Trash2} label={t('delete')} onClick={() => setRemove(entry)} /></div></td>
    </tr>)}</tbody></table></div><Pagination count={entries.length} page={page} setPage={setPage} /></>}
    {edit && <EntryForm type={type} entry={edit} employeeId={employeeId} employees={employees} onClose={() => setEdit(null)} />}
    {remove && <Confirm danger title={t('confirm_delete')} label={t('delete')} onClose={() => setRemove(null)} onConfirm={async () => { await api('/employees/' + (employeeId || remove.employee_id) + '/' + type + '/' + remove.id, { method: 'DELETE' }); refresh(); notify(t('deleted')); }} />}</>;
}

export default function Entries({ type }) {
    const { t } = useI18n(); const { period } = useApp(); const [add, setAdd] = useState(false); const [search, setSearch] = useState('');
    const { data, loading, error } = useLoad('/entries/' + type + '?' + periodQuery(period));
    const employees = useLoad('/employees?' + periodQuery(period)); const isAdvance = type === 'advances';
    const filtered = (data || []).filter(e => [e.name, e.employee_number, e.note || e.reason || ''].some(v => v.toLowerCase().includes(search.toLowerCase())));
    return <><PageHeading eyebrow={t(type)} title={t(isAdvance ? 'record_advance' : 'record_absence')} description={t(isAdvance ? 'advance_body' : 'absence_body')}><ExportLink type={type} /><Button icon={Plus} onClick={() => setAdd(true)}>{t(isAdvance ? 'add_advance' : 'add_absence')}</Button></PageHeading><PeriodPicker />
        <section className="card"><div className="table-toolbar"><SearchInput value={search} onChange={setSearch} /></div>{error ? <LoadError error={error} /> : loading ? <Loading /> : <EntryTable type={type} entries={filtered} employees={employees.data?.employees || []} />}</section>
        {add && <EntryForm type={type} employees={employees.data?.employees || []} onClose={() => setAdd(false)} />}</>;
}
