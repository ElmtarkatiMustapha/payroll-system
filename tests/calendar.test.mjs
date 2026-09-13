import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollDay, payrollSelection, shiftDate } from '../resources/js/lib/payroll-calendar.js';

const employee = { start_date: '2024-01-01', end_date: '2026-08-31', statements: [
    { id: 1, from: '2026-07-31', to: '2026-08-02', status: 'paid' },
    { id: 2, from: '2026-08-10', to: '2026-08-12', status: 'finalized' },
] };
const cutoff = '2026-09-13';
const select = (from, to, person = employee) => payrollSelection(person, { from, to }, cutoff);

test('paid days stay unavailable to a range even when both endpoints are unfinalized', () => {
    assert.equal(payrollDay(employee, '2026-07-30', cutoff).status, 'unfinalized');
    assert.equal(payrollDay(employee, '2026-08-03', cutoff).status, 'unfinalized');
    assert.equal(select('2026-07-30', '2026-08-03').error, 'calendar_paid_range');
    assert.equal(select('2026-07-31', '2026-08-02').error, 'calendar_paid_range');
});

test('yellow periods open their existing statement and cannot be merged or partially finalized', () => {
    assert.equal(select('2026-08-10', '2026-08-12').statement.id, 2);
    assert.equal(select('2026-08-11', '2026-08-11').error, 'calendar_finalized_range');
    assert.equal(select('2026-08-09', '2026-08-13').error, 'calendar_finalized_range');
    assert.equal(select('2026-08-03', '2026-08-09').status, 'unfinalized');
});

test('payment refresh and employee changes immediately change date eligibility', () => {
    const paid = { ...employee, statements: employee.statements.map(s => ({ ...s, status: 'paid' })) };
    assert.equal(payrollDay(paid, '2026-08-11', cutoff).status, 'paid');
    assert.equal(select('2026-08-10', '2026-08-12', paid).error, 'calendar_paid_range');
    const other = { ...employee, statements: [] };
    assert.equal(select('2026-07-31', '2026-08-02', other).status, 'unfinalized');
});

test('employment dates and today bound eligible days, including single-day periods', () => {
    assert.equal(payrollDay(employee, '2023-12-31', cutoff).status, 'unavailable');
    assert.equal(payrollDay(employee, '2026-09-01', cutoff).status, 'unavailable');
    assert.equal(select('2026-08-31', '2026-08-31').status, 'unfinalized');
    assert.equal(select('2026-08-31', '2026-09-01').error, 'outside_employment');
    const active = { ...employee, end_date: null };
    assert.equal(payrollDay(active, '2026-09-14', cutoff).status, 'unavailable');
    assert.equal(select(cutoff, cutoff, active).status, 'unfinalized');
    assert.equal(select(cutoff, '2026-09-14', active).error, 'calendar_future');
});

test('inclusive ranges handle leap days, the 366-day limit, invalid dates and reverse selection', () => {
    assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
    assert.equal(shiftDate('2024-02-29', 1), '2024-03-01');
    assert.equal(select('2024-01-01', '2024-12-31').status, 'unfinalized');
    assert.equal(select('2024-01-01', '2025-01-01').error, 'period_too_long');
    assert.equal(select('2026-02-29', '2026-03-01').error, 'calendar_invalid_dates');
    assert.equal(select('invalid', '2026-03-01').error, 'calendar_invalid_dates');
    assert.equal(select('2026-03-02', '2026-03-01').error, 'calendar_invalid_dates');
});

test('reactivation makes the return date eligible while every gap remains unavailable', () => {
    const rehired = { ...employee, end_date: null, statements: [], employment_periods: [
        { start_date: '2024-01-01', end_date: '2026-08-31' },
        { start_date: '2026-09-03', end_date: '2026-09-05' },
        { start_date: '2026-09-10', end_date: null },
    ] };
    for (const date of ['2026-09-01', '2026-09-02', '2026-09-06', '2026-09-09']) {
        assert.equal(payrollDay(rehired, date, cutoff).status, 'unavailable');
        assert.equal(select(date, date, rehired).error, 'calendar_employment_gap');
    }
    assert.equal(payrollDay(rehired, '2026-09-10', cutoff).status, 'unfinalized');
    assert.equal(select('2026-09-10', '2026-09-13', rehired).status, 'unfinalized');
    assert.equal(select('2026-08-31', '2026-09-04', rehired).error, 'calendar_employment_gap');
    assert.equal(select('2026-09-04', '2026-09-11', rehired).error, 'calendar_employment_gap');
});
