import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-arabic';
import '../css/payroll.css';
import { LanguageProvider, useI18n } from './lib/i18n';
import { AppProvider, useApp } from './lib/context';
import { Loading, Button, Empty } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Employee from './pages/Employee';
import Entries from './pages/Entries';
import Statements, { NewStatement, StatementDetail } from './pages/Statements';
import Settings, { Account } from './pages/Settings';

class ErrorBoundary extends React.Component {
    state = { error: false };
    static getDerivedStateFromError() { return { error: true }; }
    render() { return this.state.error ? <div className="loading-state"><p>Unable to load / Chargement impossible / تعذر التحميل</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload / Actualiser / إعادة التحميل</button></div> : this.props.children; }
}
function App() {
    const { session, bootError, boot } = useApp(); const { t } = useI18n();
    if (bootError) return <div className="loading-state"><p>{t('error')}</p><Button onClick={boot}>{t('retry')}</Button></div>;
    if (!session) return <Loading />;
    return <Routes><Route path="/login" element={<Login />} /><Route element={session.user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} /><Route path="employees" element={<Employees />} /><Route path="employees/:id" element={<Employee />} />
        <Route path="advances" element={<Entries key="advances" type="advances" />} /><Route path="absences" element={<Entries key="absences" type="absences" />} />
        <Route path="statements" element={<Statements />} /><Route path="statements/new" element={<NewStatement />} /><Route path="statements/:id" element={<StatementDetail />} />
        <Route path="settings" element={<Settings />} /><Route path="account" element={<Account />} />
        <Route path="*" element={<Empty title={t('not_found')}><Link to="/" className="btn btn-primary">{t('dashboard')}</Link></Empty>} />
    </Route></Routes>;
}
createRoot(document.getElementById('app')).render(<ErrorBoundary><LanguageProvider><BrowserRouter><AppProvider><App /></AppProvider></BrowserRouter></LanguageProvider></ErrorBoundary>);
