import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pencil, Trash2, Archive, ArchiveRestore, UsersRound } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApp } from '../lib/context';
import { api } from '../lib/api';
import { Avatar, Badge, Button, Empty, IconButton, SearchInput, Pagination, Confirm } from './ui';
import { EmployeeForm, ArchiveForm } from './Forms';

export default function EmployeeTable({ employees, compact = false, onAdd }) {
    const { t, money, date } = useI18n(); const { session, refresh, notify } = useApp();
    const [search, setSearch] = useState(''); const [status, setStatus] = useState('active'); const [page, setPage] = useState(1);
    const [edit, setEdit] = useState(null); const [archive, setArchive] = useState(null); const [remove, setRemove] = useState(null);
    const filtered = employees.filter(e => (!search || [e.name, e.cin, e.employee_number].some(v => v.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
        && (status === 'all' || (status === 'archived' ? !!e.archived_at : !e.archived_at)));
    const shown = compact ? filtered.slice(0, 5) : filtered.slice((page - 1) * 10, page * 10);
    useEffect(() => setPage(1), [search, status]);
    useEffect(() => setPage(p => Math.min(p, Math.max(1, Math.ceil(filtered.length / 10)))), [filtered.length]);
    if (!employees.length) return <Empty icon={UsersRound} title={t('empty_employees')} body={t('empty_employees_body')}><Button onClick={onAdd}>{t('add_employee')}</Button></Empty>;
    return <>
        {!compact && <div className="table-toolbar"><SearchInput value={search} onChange={setSearch} /><select aria-label={t('status')} value={status} onChange={e => setStatus(e.target.value)}><option value="active">{t('active')}</option><option value="all">{t('all')}</option><option value="archived">{t('archived')}</option></select></div>}
        {!shown.length ? <Empty title={t('no_results')} /> : <div className="table-scroll"><table><thead><tr><th>{t('employee')}</th>{!compact && <th>{t('cin')}</th>}<th>{t('daily_salary')}</th><th>{t('outstanding')}</th><th>{t('status')}</th><th><span className="sr-only">{t('actions')}</span></th></tr></thead>
            <tbody>{shown.map(e => <tr key={e.id}><td><Link className="person-cell" to={'/employees/' + e.id}><Avatar name={e.name} /><span><strong>{e.name}</strong><small>#{e.employee_number}{compact ? ' · ' + date(e.start_date) : ''}</small></span></Link></td>
                {!compact && <td><span className="mono">{e.cin}</span></td>}<td className="money-cell">{money(e.daily_salary_cents, session.settings.currency)}<small>{t('per_day')}</small></td><td className={'money-cell ' + (e.totals.outstanding_cents < 0 ? 'negative' : '')}>{money(e.totals.outstanding_cents, session.settings.currency)}</td>
                <td><Badge status={e.archived_at ? 'archived' : 'active'} /></td><td><div className="row-actions">{!compact && <><IconButton label={t('edit')} icon={Pencil} onClick={() => setEdit(e)} /><IconButton label={t(e.archived_at ? 'restore' : 'archive')} icon={e.archived_at ? ArchiveRestore : Archive} onClick={() => setArchive(e)} /><IconButton label={t('delete')} icon={Trash2} onClick={() => setRemove(e)} /></>}<Link to={'/employees/' + e.id} className="icon-button" aria-label={t('view')}><ArrowUpRight size={17} /></Link></div></td></tr>)}</tbody></table></div>}
        {!compact && <Pagination count={filtered.length} page={page} setPage={setPage} />}
        {edit && <EmployeeForm employee={edit} onClose={() => setEdit(null)} />}{archive && <ArchiveForm employee={archive} onClose={() => setArchive(null)} />}
        {remove && <Confirm danger title={t('confirm_delete')} body={t('delete_employee_body')} label={t('delete')} onClose={() => setRemove(null)} onConfirm={async () => { await api('/employees/' + remove.id, { method: 'DELETE' }); refresh(); notify(t('deleted')); }} />}
    </>;
}
