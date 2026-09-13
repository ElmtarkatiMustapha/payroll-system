import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp, useLoad } from '../lib/context';
import { useI18n } from '../lib/i18n';
import { PageHeading, Button, PeriodPicker, Loading, LoadError, ExportLink, periodQuery } from '../components/ui';
import EmployeeTable from '../components/EmployeeTable';
import { EmployeeForm } from '../components/Forms';

export default function Employees() {
    const { t } = useI18n(); const { period } = useApp();
    const { data, loading, error } = useLoad('/employees?' + periodQuery(period)); const [add, setAdd] = useState(false);
    return <><PageHeading eyebrow={t('employees')} title={t('team_title')} description={t('team_body')}><ExportLink type="employees" /><Button icon={Plus} onClick={() => setAdd(true)}>{t('add_employee')}</Button></PageHeading><PeriodPicker />
        {error ? <LoadError error={error} /> : loading && !data ? <Loading /> : <section className={'card ' + (loading ? 'is-refreshing' : '')}><EmployeeTable employees={data?.employees || []} onAdd={() => setAdd(true)} /></section>}
        {add && <EmployeeForm onClose={() => setAdd(false)} />}
    </>;
}
