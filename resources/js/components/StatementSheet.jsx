import React, { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Badge } from './ui';

export default function StatementSheet({ snapshot, statement, printable = false }) {
    const { t, date, money, number } = useI18n(); const [expanded, setExpanded] = useState(false);
    const { employee, company, totals, daily_breakdown: days } = snapshot;
    // Saved snapshots predate payment; use the recorded payment when viewing a paid statement.
    const paidCents = statement?.status === 'paid' ? statement.total_cents : (totals.settled_cents ?? 0);
    const remainingCents = totals.remaining_cents - paidCents;
    const fmt = cents => money(cents, company.currency);
    const usedRates = [...new Set(days.filter(day => day.scheduled_days).map(day => day.rate_cents))];
    return <article className={'statement-sheet print-area ' + (printable ? 'printable' : '')}>
        <div className="statement-letterhead"><div><span className="statement-logo"><Building2 size={25} />{company.company_name}</span><p>{company.company_address}</p><p dir="ltr">{company.company_phone}</p></div><div className="statement-ref"><span className="eyebrow">{t('statement')}</span><strong>{statement ? 'PAY-' + String(statement.id).padStart(5, '0') : t('draft')}</strong><Badge status={statement?.status || 'draft'} /></div></div>
        <div className="statement-employee"><div><small>{t('employee')}</small><h2>{employee.name}</h2><span>#{employee.employee_number} · {t('cin')}: {employee.cin}</span><p dir="ltr">{employee.phone}</p></div><div className="statement-period"><small>{t('period')}</small><strong>{date(snapshot.from)} — {date(snapshot.to)}</strong><span>{t('start_date')}: {date(employee.start_date)}</span>{employee.end_date && <span>{t('end_date')}: {date(employee.end_date)}</span>}</div></div>
        <div className="statement-meta"><span>{t('tshirt_size')}: <b>{employee.tshirt_size}</b></span><span>{t('trouser_size')}: <b>{employee.trouser_size}</b></span><span>{t('daily_salary')}: <b>{usedRates.map(fmt).join(' / ') || '—'}</b></span></div>
        <div className="statement-days">{[['scheduled_days', totals.scheduled_days], ['worked_days', totals.worked_days], ['absence_days', totals.absence_days], ['unpaid_absence_days', totals.unpaid_absence_days]].map(([key, value]) => <div key={key}><strong>{number(value)}</strong><span>{t(key)}</span></div>)}</div>
        <div className="statement-calculation"><div><span>{t('base_salary')}</span><strong>{fmt(totals.base_cents)}</strong></div><div><span>{t('deductions')}</span><strong>− {fmt(totals.deduction_cents)}</strong></div><div><span>{t('total_advances')}</span><strong>− {fmt(totals.advances_cents)}</strong></div><div className="statement-paid-total"><span>{t('total_paid_statements')}</span><strong>{paidCents < 0 ? '+' : '−'} {fmt(Math.abs(paidCents))}</strong></div><div className={'statement-total ' + (remainingCents < 0 ? 'negative-total' : '')}><span>{t('remaining')}</span><strong>{fmt(remainingCents)}</strong></div></div>
        <p className="statement-formula">{t('formula_hint')}</p>{remainingCents < 0 && <p className="balance-notice">{t('negative_balance')}</p>}
        {!!snapshot.advances.length && <section className="statement-detail"><h3>{t('advances')}</h3><table><thead><tr><th>{t('date')}</th><th>{t('note')}</th><th>{t('amount')}</th></tr></thead><tbody>{snapshot.advances.map(a => <tr key={a.id}><td>{date(a.date)}</td><td>{a.note || '—'}</td><td>{fmt(a.amount_cents)}</td></tr>)}</tbody></table></section>}
        {!!snapshot.absences.length && <section className="statement-detail"><h3>{t('absences')}</h3><table><thead><tr><th>{t('date')}</th><th>{t('days')}</th><th>{t('reason')}</th><th>{t('is_paid')}</th></tr></thead><tbody>{snapshot.absences.map(a => <tr key={a.id}><td>{date(a.date)}</td><td>{number(a.days)}</td><td>{a.reason || '—'}</td><td>{t(a.is_paid ? 'yes' : 'no')}</td></tr>)}</tbody></table></section>}
        <div className={'statement-daily ' + (expanded ? 'expanded' : '')}><button className="text-button no-print" onClick={() => setExpanded(!expanded)}>{t('show_breakdown')}<ChevronDown size={15} /></button><div className="daily-table"><h3>{t('daily_breakdown')}</h3><table><thead><tr><th>{t('date')}</th><th>{t('daily_salary')}</th><th>{t('scheduled_days')}</th><th>{t('deductions')}</th><th>{t('advances')}</th><th>{t('remaining')}</th></tr></thead><tbody>{days.filter(day => day.scheduled_days || day.advances_cents).map(day => <tr key={day.date}><td>{date(day.date)}</td><td>{fmt(day.rate_cents)}</td><td>{number(day.scheduled_days)}</td><td>{fmt(day.deduction_cents)}</td><td>{fmt(day.advances_cents)}</td><td>{fmt(day.remaining_cents)}</td></tr>)}</tbody></table></div></div>
        {statement?.paid_on && <div className="statement-paid"><Badge status="paid" />{t('paid_on')}: {date(statement.paid_on)}</div>}
        <div className="statement-signatures"><div><span>{t('signature_employee')}</span><i /></div><div><span>{t('signature_company')}</span><i /></div></div>
        <div className="statement-bottom"><span>{company.company_name}</span><span>{t('generated_at')}: {date(snapshot.generated_at)}</span></div>
    </article>;
}
