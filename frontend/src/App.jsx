import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import AdminView from './pages/AdminView';
import EmployeeView from './pages/EmployeeView';
import { api } from './hooks/api';

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
      <div style={{ minHeight: '100vh', background: '#0d0d17', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d17', color: '#f1f5f9', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: '#141420', borderBottom: '1px solid #1e1e2e',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 700, color: '#fff',
          }}>T</div>
          <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.3px' }}>TeamPulse</span>
          <span style={{
            fontSize: '11px', color: '#64748b', background: '#1e1e2e', padding: '2px 8px',
            borderRadius: '4px', marginLeft: '8px',
          }}>
            {isAdmin ? 'ADMIN' : 'EMPLOYEE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>{user.name}</span>
          <button onClick={handleLogout} style={{
            padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
            background: 'transparent', border: '1px solid #2a2a3a', color: '#64748b', cursor: 'pointer',
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
