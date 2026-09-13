export const calendarDate = value => new Date(value + 'T12:00:00Z');
export const isoDate = value => value.toISOString().slice(0, 10);
export const shiftDate = (value, days) => {
    const date = calendarDate(value);
    date.setUTCDate(date.getUTCDate() + days);
    return isoDate(date);
};

export function payrollDay(employee, date, cutoff) {
    const statement = employee.statements.find(s => s.from <= date && s.to >= date);
    if (statement) return { status: statement.status === 'paid' ? 'paid' : 'finalized', statement };
    if (date < employee.start_date || (employee.end_date && date > employee.end_date) || date > cutoff) {
        return { status: 'unavailable' };
    }
    return { status: 'unfinalized' };
}

// A new period may contain only unfinalized dates. Existing unpaid statements open as a whole.
export function payrollSelection(employee, range, cutoff) {
    if (!range?.from || !range?.to) return { error: 'calendar_choose_dates' };
    const { from, to } = range;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)
        || !Number.isFinite(+calendarDate(from)) || !Number.isFinite(+calendarDate(to))
        || isoDate(calendarDate(from)) !== from || isoDate(calendarDate(to)) !== to || from > to) {
        return { error: 'calendar_invalid_dates' };
    }
    if ((calendarDate(to) - calendarDate(from)) / 86400000 > 365) return { error: 'period_too_long' };
    if (from < employee.start_date || (employee.end_date && to > employee.end_date)) return { error: 'outside_employment' };
    if (to > cutoff) return { error: 'calendar_future' };
    const statements = employee.statements.filter(s => s.from <= to && s.to >= from);
    if (statements.some(s => s.status === 'paid')) return { error: 'calendar_paid_range' };
    if (statements.length) {
        if (statements.length === 1 && statements[0].from === from && statements[0].to === to) {
            return { status: 'finalized', statement: statements[0] };
        }
        return { error: 'calendar_finalized_range' };
    }
    return { status: 'unfinalized' };
}
