import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Archive, ArchiveRestore, Phone, CalendarDays, Shirt, Wallet, UserRound } from 'lucide-react';
import { useApp, useLoad } from '../lib/context';
import { useI18n } from '../lib/i18n';
import { PageHeading, Button, Loading, LoadError, Avatar, Badge, PeriodPicker } from '../components/ui';
import { EmployeeForm, EntryForm, ArchiveForm } from '../components/Forms';
import { EntryTable } from './Entries';
import { NewStatement, StatementList } from './Statements';
import { today } from '../lib/api';
import PayrollCalendar from '../components/PayrollCalendar';

export default function Employee() {
    const { id } = useParams(); const navigate = useNavigate(); const { t, money, date } = useI18n(); const { session, period } = useApp();
    const { data: employee, loading, error } = useLoad('/employees/' + id); const [tab, setTab] = useState('advances'); const [modal, setModal] = useState(null);
    if (loading && !employee) return <Loading />; if (error) return <LoadError error={error} />;
    const rates = employee.salary_rates || []; const currentRate = rates.filter(r => r.effective_date <= today()).at(-1) || rates[0];
    const tabs = ['advances', 'absences', 'salary_history', 'payroll_calendar', 'payroll', 'statements'];
    const entries = tab === 'salary_history' ? [...rates].reverse() : (employee[tab] || []).filter(e => e.date >= period.from && e.date <= period.to);
    return <><div className="no-print"><Link to="/employees" className="back-link"><ArrowLeft size={16} />{t('employees')}</Link>
        <div className="employee-heading"><div><Avatar name={employee.name} large /><div><div className="employee-name-line"><h1>{employee.name}</h1><Badge status={employee.archived_at ? 'archived' : 'active'} /></div><p>#{employee.employee_number} <span>·</span> {t('cin')}: {employee.cin}</p></div></div><div className="heading-actions"><Button variant="secondary" icon={employee.archived_at ? ArchiveRestore : Archive} onClick={() => setModal('archive')}>{t(employee.archived_at ? 'restore' : 'archive')}</Button><Button icon={Pencil} onClick={() => setModal('employee')}>{t('edit_employee')}</Button></div></div>
        <section className="employee-info card"><div><span><Phone size={16} />{t('phone')}</span><strong dir="ltr">{employee.phone}</strong></div><div><span><CalendarDays size={16} />{t('start_date')}</span><strong>{date(employee.start_date)}</strong>{employee.end_date && <small>{t('end_date')}: {date(employee.end_date)}</small>}</div><div><span><Shirt size={16} />{t('tshirt_size')} / {t('trouser_size')}</span><strong>{employee.tshirt_size} / {employee.trouser_size}</strong></div><div><span><Wallet size={16} />{t('daily_salary')}</span><strong className="green-text">{money(currentRate?.rate_cents, session.settings.currency)} <small>{t('per_day')}</small></strong></div></section>
        {employee.notes && <p className="employee-notes">{employee.notes}</p>}
        <nav className="tabs" aria-label={t('employee')}>{tabs.map(key => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{t(key)}</button>)}</nav>
        </div>
        {tab === 'payroll_calendar' ? <PayrollCalendar key={id} employee={employee} workingDays={session.settings.working_days} onPreview={range => navigate('/statements/new?' + new URLSearchParams({ employee: id, ...range }))} onOpenStatement={statementId => navigate('/statements/' + statementId)} /> : tab === 'payroll' ? <NewStatement fixedEmployeeId={id} /> : tab === 'statements' ? <section className="card"><div className="card-heading"><h2>{t('statements')}</h2><Button variant="secondary" icon={Plus} onClick={() => setTab('payroll')}>{t('prepare_statement')}</Button></div><StatementList employeeView statements={employee.statements} /></section> : <>
            {tab !== 'salary_history' && <PeriodPicker />}
            <section className="card"><div className="card-heading"><div><h2>{t(tab)}</h2>{tab === 'salary_history' && <p>{t('salary_history_hint')}</p>}</div><Button icon={Plus} onClick={() => setModal(tab === 'salary_history' ? 'salary-rates' : tab)}>{t(tab === 'salary_history' ? 'add_salary' : tab === 'advances' ? 'add_advance' : 'add_absence')}</Button></div>
                <EntryTable key={tab} type={tab === 'salary_history' ? 'salary-rates' : tab} entries={entries} employeeId={id} /></section>
        </>}
        {modal === 'employee' && <EmployeeForm employee={employee} onClose={() => setModal(null)} />}{modal === 'archive' && <ArchiveForm employee={employee} onClose={() => setModal(null)} />}{['advances','absences','salary-rates'].includes(modal) && <EntryForm type={modal} employeeId={id} onClose={() => setModal(null)} />}
    </>;
}
