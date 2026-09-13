import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UsersRound, ArrowUpRight, CalendarDays, FileText, Settings2, LogOut, Menu, ChevronDown, ShieldCheck, Building2, UserRound, X } from 'lucide-react';
import { useApp } from '../lib/context';
import { useI18n, LanguageSelect } from '../lib/i18n';
import { api } from '../lib/api';
import { Avatar, IconButton } from './ui';

export default function Layout() {
    const { session, setSession, notify } = useApp(); const { t } = useI18n(); const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const links = [['/', 'dashboard', LayoutDashboard], ['/employees', 'employees', UsersRound], ['/advances', 'advances', ArrowUpRight], ['/absences', 'absences', CalendarDays], ['/statements', 'statements', FileText]];
    return <div className="app-shell">
        {open && <button className="sidebar-backdrop" aria-label={t('close')} onClick={() => setOpen(false)} />}
        <aside className={'sidebar ' + (open ? 'sidebar-open' : '')}>
            <NavLink to="/" className="brand" onClick={() => setOpen(false)}><span className="brand-icon"><Building2 size={23} /></span><span>SRT<span className="brand-light">payroll</span></span></NavLink>
            <div className="workspace-label"><span className="workspace-dot" /><span>{session.settings.company_name}</span><ChevronDown size={13} /></div>
            <div className="nav-section-label">{t('workspace')}</div><nav>{links.map(([path, key, Icon]) => <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(false)} className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}><Icon size={19} /><span>{t(key)}</span></NavLink>)}</nav>
            <div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={21} /><strong>{t('payroll_note')}</strong><p>{t('payroll_note_body')}</p></div>
                <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}><Settings2 size={19} />{t('settings')}</NavLink>
                <button className="nav-link logout" onClick={async () => { try { await api('/logout', { method: 'POST' }); setSession({ ...session, user: null }); navigate('/login'); } catch { notify(t('error'), 'error'); } }}><LogOut size={18} />{t('logout')}</button>
                <NavLink className="sidebar-user" to="/account" onClick={() => setOpen(false)}><Avatar name={session.user.name} /><span><strong>{session.user.name}</strong><small>{t('account')}</small></span><UserRound size={16} /></NavLink>
            </div>
        </aside>
        <div className="main-shell"><header className="topbar"><div className="topbar-start"><span className="mobile-menu"><IconButton icon={Menu} label={t('menu')} onClick={() => setOpen(true)} /></span><span className="topbar-company">{session.settings.company_name}</span><span className="topbar-divider">/</span><span className="topbar-muted">{t('workspace')}</span></div><div className="topbar-end"><LanguageSelect /><span className="topbar-divider">|</span><NavLink to="/account" aria-label={t('account')}><Avatar name={session.user.name} /></NavLink></div></header>
            <main className="main-content" id="main"><Outlet /></main><footer className="app-footer"><span>SRT Payroll</span><span>{t('three_languages')}</span></footer>
        </div>
    </div>;
}
