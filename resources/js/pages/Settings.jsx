import React, { useState } from 'react';
import { Save, Download, ShieldCheck, KeyRound, Building2 } from 'lucide-react';
import { useApp, useForm } from '../lib/context';
import { useI18n } from '../lib/i18n';
import { api, downloadBackup } from '../lib/api';
import { PageHeading, Button, Field, FormError, ExportLink } from '../components/ui';

export default function Settings() {
    const { t } = useI18n(); const { session, setSession, notify, refresh } = useApp();
    const form = useForm({ ...session.settings, company_address: session.settings.company_address || '', company_phone: session.settings.company_phone || '' });
    const [backing, setBacking] = useState(false);
    const weekdays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    return <><PageHeading eyebrow={t('workspace')} title={t('settings')} description={t('settings_body')} />
        <div className="settings-layout"><form className="card settings-card" onSubmit={event => form.submit(event, async values => {
            const settings = await api('/settings', { method: 'PUT', body: values }); setSession({ ...session, settings }); refresh(); notify(t('saved'));
        })}><div className="card-heading"><h2><Building2 size={19} />{t('company_details')}</h2></div><div className="settings-body"><FormError errors={form.errors} />
            {['company_name', 'company_address', 'company_phone'].map(key => <Field key={key} label={t(key)} required={key === 'company_name'} maxLength={key === 'company_phone' ? 40 : 255} value={form.values[key]} onChange={e => form.set(key, e.target.value)} />)}
            <div className="form-grid"><Field label={t('currency')} hint={t('currency_hint')}><select value={form.values.currency} onChange={e => form.set('currency', e.target.value)}>{['MAD','EUR','USD','GBP','CAD','CHF','DZD','SAR','AED'].map(c => <option key={c}>{c}</option>)}</select></Field><Field label={t('default_language')}><select value={form.values.locale} onChange={e => form.set('locale', e.target.value)}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></Field></div>
            <div className="form-section-title">{t('working_days')}</div><p className="form-hint">{t('working_days_hint')}</p><div className="weekday-options">{weekdays.map((key, i) => <label key={key} className={form.values.working_days.includes(i + 1) ? 'selected' : ''}><input type="checkbox" checked={form.values.working_days.includes(i + 1)} onChange={e => form.set('working_days', e.target.checked ? [...form.values.working_days, i + 1].sort() : form.values.working_days.filter(d => d !== i + 1))} />{t(key)}</label>)}</div>
        </div><div className="modal-footer"><Button icon={Save} busy={form.busy} type="submit">{t('save')}</Button></div></form>
        <section className="card backup-card"><div className="backup-icon"><ShieldCheck size={27} /></div><h2>{t('backups')}</h2><p>{t('backup_body')}</p><Button variant="secondary" icon={Download} busy={backing} onClick={async () => { setBacking(true); try { await downloadBackup(); } catch { notify(t('error'), 'error'); } finally { setBacking(false); } }}>{t('backup')}</Button><p className="backup-key-hint">{t('backup_key_hint')}</p><div className="export-options">{['employees', 'advances', 'absences', 'statements'].map(type => <ExportLink key={type} type={type}><Download size={15} />{t(type)}</ExportLink>)}</div></section></div></>;
}

export function Account() {
    const { t } = useI18n(); const { session, notify } = useApp();
    const form = useForm({ current_password: '', password: '', password_confirmation: '' });
    return <><PageHeading title={t('account')} description={t('account_body')} /><form className="card account-card" onSubmit={event => form.submit(event, async values => {
        await api('/password', { method: 'PUT', body: values }); form.setValues({ current_password: '', password: '', password_confirmation: '' }); notify(t('saved'));
    })}><div className="card-heading"><h2><KeyRound size={19} />{t('change_password')}</h2></div><div className="settings-body"><div className="account-identity"><strong>{session.user.name}</strong><span>{session.user.email}</span></div><FormError errors={form.errors} />
        {['current_password','password','password_confirmation'].map(key => <Field key={key} label={t(key === 'password' ? 'new_password' : key)} type="password" required autoComplete={key === 'current_password' ? 'current-password' : 'new-password'} minLength={key === 'current_password' ? undefined : 12} hint={key === 'password' ? t('password_hint') : undefined} value={form.values[key]} onChange={e => form.set(key, e.target.value)} />)}
        </div><div className="modal-footer"><Button busy={form.busy} type="submit">{t('change_password')}</Button></div></form></>;
}
