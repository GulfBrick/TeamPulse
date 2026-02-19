import React, { useState } from 'react';
import { Btn, Input, Logo, colors } from '../components/UI';
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
      background: colors.bg, position: 'relative', overflow: 'hidden',
    }}>
      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Grid pattern overlay */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="fade-in" style={{
        width: '440px', maxWidth: '90vw', background: 'rgba(15, 15, 28, 0.85)', borderRadius: '24px',
        padding: '56px 44px', border: '1px solid rgba(34,211,238,0.15)', position: 'relative',
        boxShadow: '0 0 120px rgba(34,211,238,0.08), 0 0 60px rgba(139,92,246,0.06), 0 32px 64px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Top gradient line */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: '2px',
          background: colors.gradient, borderRadius: '0 0 2px 2px',
        }} />

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* Logo — big and prominent */}
          <div className="logo-pulse" style={{ display: 'inline-block', marginBottom: '16px' }}>
            <Logo size={140} glow />
          </div>
          <h1 style={{
            fontSize: '32px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px',
            background: colors.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>TeamPulse</h1>
          <p style={{ fontSize: '14px', color: colors.textDim, letterSpacing: '0.3px' }}>Workforce Management Platform</p>
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

          <Btn type="submit" style={{
            width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700,
            borderRadius: '12px', letterSpacing: '0.3px',
            boxShadow: '0 4px 24px rgba(34,211,238,0.2), 0 2px 8px rgba(139,92,246,0.15)',
          }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Btn>
        </form>

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <span style={{ fontSize: '11px', color: colors.textDimmer, letterSpacing: '0.5px' }}>POWERED BY TEAMPULSE</span>
        </div>
      </div>
    </div>
  );
}
