import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import AdminView from './pages/AdminView';
import EmployeeView from './pages/EmployeeView';
import { api } from './hooks/api';
import { colors } from './components/UI';

export default function App() {
  const [user, setUser] = useState(api.user);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/logo.png" alt="TeamPulse" className="logo-pulse" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: colors.card, borderBottom: `1px solid ${colors.border}`,
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <img
              src="/logo.png"
              alt="TeamPulse"
              className="logo-pulse"
              style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
          <span style={{
            fontSize: '15px', fontWeight: 700, letterSpacing: '-0.3px',
            background: colors.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>TeamPulse</span>
          <span style={{
            fontSize: '10px', fontWeight: 600, color: colors.cyan, background: 'rgba(34,211,238,0.1)',
            padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(34,211,238,0.2)',
            letterSpacing: '0.5px',
          }}>
            {isAdmin ? 'ADMIN' : 'EMPLOYEE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: colors.textMuted }}>{user.name}</span>
          <button onClick={handleLogout} style={{
            padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
            background: 'transparent', border: `1px solid ${colors.borderLight}`, color: colors.textDim, cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        {isAdmin ? <AdminView /> : <EmployeeView />}
      </div>
    </div>
  );
}
