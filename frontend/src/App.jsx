import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import AdminView from './pages/AdminView';
import EmployeeView from './pages/EmployeeView';
import EmployeeDetail from './pages/EmployeeDetail';
import { api } from './hooks/api';
import { colors, Logo, Sidebar } from './components/UI';

const adminNavItems = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'team', label: 'Team' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'sessions', label: 'Work Sessions' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'kpis', label: 'KPIs' },
  { key: 'feedback', label: 'Daily Feedback' },
  { key: 'monitoring', label: 'Monitoring' },
];

const employeeNavItems = [
  { key: 'clock', label: 'Time Clock' },
  { key: 'sessions', label: 'My Sessions' },
  { key: 'timeline', label: 'My Timeline' },
  { key: 'tasks', label: 'My Tasks' },
  { key: 'kpis', label: 'My KPIs' },
];

export default function App() {
  const [user, setUser] = useState(api.user);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(null);
  const [employeeDetailId, setEmployeeDetailId] = useState(null);

  useEffect(() => {
    // Verify token on mount
    if (api.isLoggedIn) {
      api.getMe()
        .then(u => { setUser(u); api.user = u; })
        .catch(() => { api.logout(); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return api.subscribe(({ user }) => setUser(user));
  }, []);

  // Set default section based on role
  useEffect(() => {
    if (user && !section) {
      setSection(user.role === 'admin' ? 'dashboard' : 'clock');
    }
  }, [user, section]);

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setSection(null);
    setEmployeeDetailId(null);
  };

  const handleNavSelect = (key) => {
    setSection(key);
    setEmployeeDetailId(null);
  };

  const handleViewEmployee = (id) => {
    setEmployeeDetailId(id);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={100} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  const isAdmin = user.role === 'admin';
  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: "'Inter', system-ui, sans-serif", display: 'flex' }}>
      {/* Sidebar */}
      <Sidebar
        items={navItems}
        active={section}
        onSelect={handleNavSelect}
        user={user}
        onLogout={handleLogout}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
          {employeeDetailId ? (
            <EmployeeDetail
              employeeId={employeeDetailId}
              onBack={() => setEmployeeDetailId(null)}
            />
          ) : isAdmin ? (
            <AdminView section={section} onViewEmployee={handleViewEmployee} />
          ) : (
            <EmployeeView section={section} />
          )}
        </div>
      </div>
    </div>
  );
}
