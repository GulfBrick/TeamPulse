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
      background: colors.bg,
    }}>
      <div className="fade-in" style={{
        width: '440px', maxWidth: '90vw', background: colors.card, borderRadius: '16px',
        padding: '56px 44px', border: `1px solid ${colors.border}`, position: 'relative',
        boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-block', marginBottom: '16px' }}>
            <Logo size={100} />
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
              padding: '10px 14px', borderRadius: '8px', background: '#2a0f0f',
              border: '1px solid #4c1717', color: colors.red, fontSize: '13px', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <Btn type="submit" style={{
            width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700,
            borderRadius: '10px', letterSpacing: '0.3px',
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
