import React, { useState } from 'react';
import { Btn, Input, colors } from '../components/UI';
import { api } from '../hooks/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      api.setAuth(res.token, res.user);
      onLogin(res.user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: colors.bg,
    }}>
      {/* Subtle radial glow behind card */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="fade-in" style={{
        width: '420px', maxWidth: '90vw', background: colors.card, borderRadius: '20px',
        padding: '48px 40px', border: `1px solid ${colors.border}`, position: 'relative',
        boxShadow: '0 0 80px rgba(34,211,238,0.04), 0 24px 48px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          {/* Logo with pulse */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
            <img
              src="/logo.png"
              alt="TeamPulse"
              className="logo-pulse"
              style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '12px' }}
            />
            <div className="logo-ring" />
          </div>
          <h1 style={{
            fontSize: '26px', fontWeight: 800, marginBottom: '6px',
            background: colors.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>TeamPulse</h1>
          <p style={{ fontSize: '13px', color: colors.textDim }}>Sign in to your workspace</p>
        </div>

        <form onSubmit={handleLogin}>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" />

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', background: '#3b1010',
              border: '1px solid #5c1a1a', color: '#f87171', fontSize: '13px', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <Btn type="submit" style={{ width: '100%', padding: '12px', fontSize: '14px' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Btn>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ fontSize: '11px', color: colors.textDimmer }}>Powered by TeamPulse</span>
        </div>
      </div>
    </div>
  );
}
