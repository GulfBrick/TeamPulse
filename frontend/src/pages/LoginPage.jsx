import React, { useState } from 'react';
import { Btn, Input } from '../components/UI';
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
      background: '#0d0d17',
    }}>
      <div style={{
        width: '400px', maxWidth: '90vw', background: '#141420', borderRadius: '16px',
        padding: '40px', border: '1px solid #1e1e2e',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 700, marginBottom: '16px',
          }}>T</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>TeamPulse</h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin}>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', background: '#3b1010',
              border: '1px solid #5c1a1a', color: '#f87171', fontSize: '13px', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <Btn type="submit" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
