import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UsersRound, Wallet, ArrowUpRight, Plus, CalendarDays, FileText, ArrowRight, Banknote, CircleDollarSign } from 'lucide-react';
import { useApp, useLoad } from '../lib/context';
import { useI18n } from '../lib/i18n';
import { PageHeading, Button, PeriodPicker, Loading, LoadError, StatCard, periodQuery, Avatar, Empty } from '../components/ui';
import EmployeeTable from '../components/EmployeeTable';
import { EmployeeForm, EntryForm } from '../components/Forms';

export default function Dashboard() {
    const { t, money, number, date } = useI18n(); const { period, session } = useApp();
    const { data, loading, error } = useLoad('/employees?' + periodQuery(period));
    const recent = useLoad('/entries/advances?' + periodQuery(period));
    const [modal, setModal] = useState(null);
    if (loading && !data) return <Loading />; if (error) return <LoadError error={error} />;
    const employees = data?.employees || [];
    const sum = key => employees.reduce((total, e) => total + e.totals[key], 0);
    const base = sum('base_cents'), advances = sum('advances_cents'), deductions = sum('deduction_cents'), outstanding = sum('outstanding_cents');
    const currency = session.settings.currency;
    const active = employees.filter(e => !e.archived_at);
    return <><PageHeading eyebrow={t('dashboard')} title={t('overview_title')} description={t('overview_body')}><Button icon={Plus} onClick={() => setModal('employee')}>{t('add_employee')}</Button></PageHeading>
        <PeriodPicker /><div className={'dashboard-content ' + (loading ? 'is-refreshing' : '')}>
        <div className="stats-grid"><StatCard label={t('total_employees')} value={number(employees.length)} icon={UsersRound} foot={number(active.length) + ' ' + t('active_team')} /><StatCard label={t('base_salary')} value={money(base, currency)} icon={Banknote} foot={t('period')} /><StatCard label={t('total_advances')} value={money(advances, currency)} icon={ArrowUpRight} foot={t('period')} /><StatCard accent label={t('outstanding')} value={money(outstanding, currency)} icon={Wallet} foot={t('settled') + ': ' + money(sum('settled_cents'), currency)} /></div>
        <div className="dashboard-middle"><section className="card overview-card"><div className="card-heading"><div><h2>{t('period_overview')}</h2><p>{t('period_description')}</p></div><span className="soft-label">{session.settings.currency}</span></div>
            <div className="payroll-distribution"><div className="distribution-total"><span>{t('base_salary')}</span><strong>{money(base, currency)}</strong></div><div className="distribution-bar" role="img" aria-label={[t('outstanding') + ': ' + money(outstanding, currency), t('total_advances') + ': ' + money(advances, currency), t('deductions') + ': ' + money(deductions, currency)].join('; ')}>{base > 0 ? <><span className="distribution-net" style={{ width: Math.max(0, (base - Math.min(advances, base) - deductions) / base * 100) + '%' }} /><span className="distribution-advance" style={{ width: Math.min(100, advances / base * 100) + '%' }} /><span className="distribution-absence" style={{ width: Math.min(100, deductions / base * 100) + '%' }} /></> : <span className="distribution-empty" />}</div>
                <div className="distribution-legend">{[[t('remaining'), base - advances - deductions, 'green'], [t('advances'), advances, 'amber'], [t('deductions'), deductions, 'slate']].map(([label, amount, color]) => <div key={label}><span><i className={'legend-dot ' + color} />{label}</span><strong>{money(amount, currency)}</strong></div>)}</div>
            </div><div className="overview-footer"><CalendarDays size={15} />{date(period.from)} — {date(period.to)}<span>{number(sum('worked_days'))} {t('worked_days').toLocaleLowerCase()}</span></div>
        </section><section className="quick-card"><div className="quick-heading"><span className="quick-star">✳</span><h2>{t('quick_actions')}</h2><p>{t('quick_body')}</p></div>
            <button onClick={() => setModal('advances')}><span className="quick-icon"><ArrowUpRight size={18} /></span>{t('record_advance')}<ArrowRight size={17} /></button>
            <button onClick={() => setModal('absences')}><span className="quick-icon"><CalendarDays size={18} /></span>{t('record_absence')}<ArrowRight size={17} /></button>
            <Link to="/statements/new"><span className="quick-icon"><FileText size={18} /></span>{t('prepare_statement')}<ArrowRight size={17} /></Link>
        </section></div>
        <section className="card"><div className="card-heading"><h2>{t('team_directory')} <span className="count-pill">{number(active.length)}</span></h2><Link className="text-link" to="/employees">{t('view_all')}<ArrowRight size={15} /></Link></div><EmployeeTable compact employees={employees} onAdd={() => setModal('employee')} /></section>
        {recent.data?.length > 0 && <section className="card recent-card"><div className="card-heading"><h2>{t('recent_activity')}</h2><Link to="/advances" className="text-link"><ArrowRight size={17} /></Link></div><div className="recent-list">{recent.data.slice(0, 4).map(a => <Link key={a.id} to={'/employees/' + a.employee_id} className="recent-item"><Avatar name={a.name} /><span><strong>{a.name}</strong><small>{date(a.date)}</small></span><b>{money(a.amount_cents, currency)}</b></Link>)}</div></section>}
        </div>{modal === 'employee' && <EmployeeForm onClose={() => setModal(null)} />}{['advances', 'absences'].includes(modal) && <EntryForm type={modal} employees={employees} onClose={() => setModal(null)} />}</>;
}
