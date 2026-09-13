import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Check, ShieldCheck, Globe2 } from 'lucide-react';
import { useApp, useForm } from '../lib/context';
import { useI18n, LanguageSelect } from '../lib/i18n';
import { api } from '../lib/api';
import { Button, Field, FormError } from '../components/ui';

export default function Login() {
    const { session, setSession } = useApp(); const { t } = useI18n(); const navigate = useNavigate();
    const setup = session.setup_required;
    const form = useForm({ email: '', password: '', password_confirmation: '', name: '', company_name: '' });
    if (session.user) return <Navigate to="/" replace />;
    const field = (key, label = key, type = 'text', extra = {}) => <Field label={t(label)} error={form.errors[key]} type={type} required value={form.values[key]} onChange={e => form.set(key, e.target.value)} {...extra} />;
    return <div className="login-page"><section className="login-story"><div className="brand brand-inverse"><span className="brand-icon"><Building2 size={24} /></span><span>SRT<span className="brand-light">payroll</span></span></div>
        <div className="login-story-content"><span className="login-eyebrow">{t('login_tag')}</span><h1>{t('login_headline')}</h1><p>{t('login_description')}</p>
            <div className="login-illustration" aria-hidden="true"><div className="illustration-top"><span className="illustration-avatar">S</span><div><div className="mock-line long" /><div className="mock-line short" /></div><span className="illustration-check"><Check size={19} /></span></div><div className="illustration-chart">{[35, 52, 42, 68, 55, 83, 72, 100, 87, 116, 102, 132].map((h, i) => <i key={i} style={{ height: h }} />)}</div><div className="illustration-footer"><span><span className="green-dot" />{t('daily_pay')}</span><Check size={16} /></div></div>
        </div><div className="login-story-footer"><Globe2 size={17} />{t('three_languages')}</div></section>
        <section className="login-form-panel"><div className="login-language"><LanguageSelect /></div><div className="login-form-content"><div className="login-small-icon"><Building2 size={26} /></div><h2>{t(setup ? 'setup_title' : 'welcome')}</h2><p>{t(setup ? 'setup_body' : 'login_body')}</p>
            <form onSubmit={event => form.submit(event, async values => { const result = await api(setup ? '/setup' : '/login', { method: 'POST', body: values }); setSession(result); navigate('/'); })}>
                <FormError errors={form.errors} />{setup && <>{field('name', 'admin_name', 'text', { autoComplete: 'name', maxLength: 100 })}{field('company_name', 'company_name', 'text', { autoComplete: 'organization', maxLength: 255 })}</>}
                {field('email', 'email', 'email', { autoComplete: 'username' })}{field('password', 'password', 'password', { autoComplete: setup ? 'new-password' : 'current-password', minLength: setup ? 12 : undefined, hint: setup ? t('password_hint') : undefined })}
                {setup && field('password_confirmation', 'password_confirmation', 'password', { autoComplete: 'new-password', minLength: 12 })}
                <Button busy={form.busy} icon={ArrowRight} type="submit" className="login-submit">{t(setup ? 'create_workspace' : 'login')}</Button>
            </form><div className="login-security"><ShieldCheck size={15} />{t('secure_workspace')}</div>
        </div><div className="login-copyright">© {new Date().getFullYear()} SRT Payroll</div></section>
    </div>;
}
