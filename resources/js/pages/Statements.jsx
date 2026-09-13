import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Printer, CheckCheck, LockKeyhole, ArrowLeft, FileText } from 'lucide-react';
import { useApp, useLoad, useForm } from '../lib/context';
import { useI18n } from '../lib/i18n';
import { api, today } from '../lib/api';
import { PageHeading, Button, PeriodPicker, Loading, LoadError, ExportLink, periodQuery, Empty, Badge, Field, Modal, Confirm, FormError, Pagination } from '../components/ui';
import StatementSheet from '../components/StatementSheet';
import PayrollCalendar from '../components/PayrollCalendar';
import { payrollSelection } from '../lib/payroll-calendar';

export function PayForm({ statement, onClose }) {
    const { t } = useI18n(); const { refresh, notify } = useApp(); const form = useForm({ paid_on: today() });
    return <Modal title={t('mark_paid')} onClose={onClose}><form onSubmit={event => form.submit(event, async values => {
        await api('/statements/' + statement.id + '/pay', { method: 'POST', body: values });
        notify(t('payment_recorded')); refresh(); onClose();
    })}><div className="modal-body"><p className="muted">{t('payment_confirmation')}</p><FormError errors={form.errors} /><Field label={t('paid_on')} type="date" required min={statement.to} max={today()} value={form.values.paid_on} onChange={e => form.set('paid_on', e.target.value)} /></div>
        <div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button type="submit" busy={form.busy}>{t('mark_paid')}</Button></div></form></Modal>;
}

export function StatementList({ statements, employeeView = false }) {
    const { t, money, date } = useI18n(); const { session } = useApp(); const [page, setPage] = useState(1);
    const shown = statements.slice((page - 1) * 10, page * 10);
    if (!statements.length) return <Empty icon={FileText} />;
    return <><div className="table-scroll"><table><thead><tr><th>{t('reference')}</th>{!employeeView && <th>{t('employee')}</th>}<th>{t('period')}</th><th>{t('remaining')}</th><th>{t('status')}</th><th>{t('paid_on')}</th></tr></thead><tbody>{shown.map(s => <tr key={s.id}><td><Link className="text-link mono" to={'/statements/' + s.id}>PAY-{String(s.id).padStart(5, '0')}</Link></td>{!employeeView && <td>{s.employee?.name}</td>}<td>{date(s.from)} — {date(s.to)}</td><td className="money-cell">{money(s.total_cents, session.settings.currency)}</td><td><Badge status={s.status} /></td><td>{date(s.paid_on)}</td></tr>)}</tbody></table></div><Pagination count={statements.length} page={page} setPage={setPage} /></>;
}

export default function Statements() {
    const { t } = useI18n(); const { period } = useApp(); const { data, loading, error } = useLoad('/statements');
    const filtered = (data || []).filter(s => s.from <= period.to && s.to >= period.from);
    return <><PageHeading eyebrow={t('payroll')} title={t('statements')} description={t('statement_body')}><ExportLink type="statements" /><Link className="btn btn-primary" to="/statements/new"><Plus size={16} />{t('prepare_statement')}</Link></PageHeading><PeriodPicker /><section className="card">{error ? <LoadError error={error} /> : loading ? <Loading /> : <StatementList key={periodQuery(period)} statements={filtered} />}</section></>;
}

export function NewStatement({ fixedEmployeeId }) {
    const { t } = useI18n(); const { period, session, refresh, notify } = useApp(); const navigate = useNavigate();
    const [searchParams] = useSearchParams(); const [employeeId, setEmployeeId] = useState(fixedEmployeeId || searchParams.get('employee') || '');
    const initialPeriod = searchParams.get('from') && searchParams.get('to') ? { from: searchParams.get('from'), to: searchParams.get('to') } : null;
    const [selection, setSelection] = useState(initialPeriod ? { ...initialPeriod, employeeId } : null);
    const [mode, setMode] = useState('prepare');
    const [confirm, setConfirm] = useState(false); const employees = useLoad(!fixedEmployeeId ? '/employees?' + periodQuery(period) : null);
    const details = useLoad(employeeId ? '/employees/' + employeeId : null);
    const employee = !details.loading && String(details.data?.id) === String(employeeId) ? details.data : null;
    const selectedPeriod = String(selection?.employeeId) === String(employeeId) ? selection : null;
    const eligibility = employee ? payrollSelection(employee, selectedPeriod, today()) : null;
    const activePeriod = mode === 'report' ? period : eligibility?.status === 'unfinalized' ? selectedPeriod : null;
    const preview = useLoad(employeeId && activePeriod ? '/employees/' + employeeId + '/payroll?' + periodQuery({ from: activePeriod.from, to: activePeriod.to }) : null);
    const openStatement = id => navigate('/statements/' + id);
    return <><div className="no-print">{!fixedEmployeeId && <PageHeading eyebrow={t('payroll')} title={t('prepare_statement')} description={t('choose_period')} />}
        <div className="payroll-controls">{!fixedEmployeeId && <Field label={t('employee')}><select value={employeeId} onChange={e => { setEmployeeId(e.target.value); setSelection(null); }}><option value="">{t('select_employee')}</option>{employees.data?.employees.map(e => <option key={e.id} value={e.id}>{e.name} · #{e.employee_number}</option>)}</select></Field>}</div>
        <div className="payroll-modes" role="group" aria-label={t('payroll')}><button type="button" aria-pressed={mode === 'prepare'} onClick={() => setMode('prepare')}>{t('calendar_select_unpaid')}</button><button type="button" aria-pressed={mode === 'report'} onClick={() => setMode('report')}>{t('calendar_period_report')}</button></div>
        {mode === 'report' && <><p className="report-description">{t('calendar_report_hint')}</p><PeriodPicker /></>}
        {mode === 'prepare' && employeeId && (details.error ? <LoadError error={details.error} /> : !employee ? <Loading /> : <PayrollCalendar key={employeeId} employee={employee} workingDays={session.settings.working_days} initialPeriod={selectedPeriod} onChange={() => setSelection(null)} onPreview={value => setSelection({ ...value, employeeId })} onOpenStatement={openStatement} />)}
        </div>
        {employeeId ? activePeriod && (preview.error ? <LoadError error={preview.error} /> : preview.loading ? <Loading /> : preview.data && <><div className="statement-actions no-print"><p>{t('pdf_hint')}</p><div><Button variant="secondary" icon={Printer} onClick={() => window.print()}>{t('print')}</Button>{preview.data.statement ? <Link className="btn btn-primary" to={'/statements/' + preview.data.statement.id}>{t('view')}</Link> : mode === 'prepare' && <Button icon={LockKeyhole} onClick={() => setConfirm(true)}>{t('finalize')}</Button>}</div></div><StatementSheet snapshot={preview.data.snapshot} statement={preview.data.statement} /></>) : <section className="card no-print">{employees.error ? <LoadError error={employees.error} /> : <Empty icon={FileText} title={t('select_employee')} body={t('choose_period')} />}</section>}
        {confirm && <Confirm title={t('finalize_title')} body={t('finalize_body')} label={t('finalize')} onClose={() => setConfirm(false)} onConfirm={async () => {
            const result = await api('/employees/' + employeeId + '/statements', { method: 'POST', body: { from: activePeriod.from, to: activePeriod.to } });
            refresh(); notify(t('saved')); navigate('/statements/' + result.id);
        }} />}</>;
}

export function StatementDetail() {
    const { id } = useParams(); const { t } = useI18n(); const { data, loading, error } = useLoad('/statements/' + id); const [pay, setPay] = useState(false);
    if (loading) return <Loading />; if (error) return <LoadError error={error} />;
    return <><div className="no-print"><Link className="back-link" to="/statements"><ArrowLeft size={16} />{t('statements')}</Link><PageHeading title={t('statement')} description={'PAY-' + String(data.id).padStart(5, '0')}><Button variant="secondary" icon={Printer} onClick={() => window.print()}>{t('print')}</Button>{data.status !== 'paid' && data.total_cents >= 0 && <Button icon={CheckCheck} onClick={() => setPay(true)}>{t('mark_paid')}</Button>}</PageHeading><p className="print-hint">{t('pdf_hint')}</p></div><StatementSheet snapshot={data.snapshot} statement={data} />{pay && <PayForm statement={data} onClose={() => setPay(false)} />}</>;
}
