import React from 'react';

// ─── Styles ───────────────────────────────────────────────────

const colors = {
  bg: '#0d0d17',
  card: '#141420',
  border: '#1e1e2e',
  borderLight: '#2a2a3a',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  textDimmer: '#475569',
  blue: '#3b82f6',
  green: '#34d399',
  red: '#f87171',
  yellow: '#fbbf24',
  purple: '#a78bfa',
};

const badgeColors = {
  'clocked-in': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'clocked-out': { bg: '#1e1e2e', text: '#94a3b8', border: '#334155' },
  'complete': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'in_progress': { bg: '#1e2a3a', text: '#60a5fa', border: '#1e3a5f' },
  'pending': { bg: '#2d2006', text: '#fbbf24', border: '#4a3500' },
  'overdue': { bg: '#3b1010', text: '#f87171', border: '#5c1a1a' },
  'on-track': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'behind': { bg: '#3b1010', text: '#f87171', border: '#5c1a1a' },
  'exceeded': { bg: '#1a0d33', text: '#a78bfa', border: '#2e1065' },
  'active': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'idle': { bg: '#2d2006', text: '#fbbf24', border: '#4a3500' },
};

// ─── Components ───────────────────────────────────────────────

export function Badge({ status }) {
  const c = badgeColors[status] || badgeColors['pending'];
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Card({ children, style, ...props }) {
  return (
    <div style={{
      background: colors.card, borderRadius: '12px', padding: '20px 24px',
      border: `1px solid ${colors.border}`, ...style,
    }} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = colors.blue }) {
  return (
    <Card style={{ flex: '1 1 200px' }}>
      <div style={{ fontSize: '12px', color: colors.textDim, marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: colors.textDimmer, marginTop: '4px' }}>{sub}</div>}
    </Card>
  );
}

export function Btn({ children, variant = 'primary', style, ...props }) {
  const styles = {
    primary: { background: colors.blue, color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: colors.textMuted, border: `1px solid ${colors.borderLight}` },
    danger: { background: '#dc2626', color: '#fff', border: 'none' },
    success: { background: '#059669', color: '#fff', border: 'none' },
  };
  return (
    <button {...props} style={{
      padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
      cursor: 'pointer', ...styles[variant], ...style,
    }}>
      {children}
    </button>
  );
}

export function Input({ label, ...props }) {
  const baseStyle = {
    width: '100%', padding: '10px 14px', background: colors.bg, border: `1px solid ${colors.borderLight}`,
    borderRadius: '8px', color: colors.text, fontSize: '14px', boxSizing: 'border-box', outline: 'none',
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      {label && <label style={{ display: 'block', fontSize: '12px', color: colors.textMuted, marginBottom: '6px', fontWeight: 500 }}>{label}</label>}
      {props.type === 'textarea' ? (
        <textarea {...props} style={{ ...baseStyle, resize: 'vertical', minHeight: '80px' }} />
      ) : props.type === 'select' ? (
        <select {...props} style={baseStyle}>{props.children}</select>
      ) : (
        <input {...props} style={baseStyle} />
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: colors.card, borderRadius: '16px', padding: '32px', width: '480px',
        maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
        border: `1px solid ${colors.borderLight}`, boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: colors.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.textDimmer }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
      <p style={{ fontSize: '14px' }}>{message}</p>
    </div>
  );
}

export function PageHeader({ title, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
      <h3 style={{ margin: 0, color: colors.text, fontSize: '16px' }}>{title}</h3>
      {right}
    </div>
  );
}

export function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{
          padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
          background: active === t ? colors.blue : 'transparent', color: active === t ? '#fff' : colors.textDim,
          border: active === t ? 'none' : `1px solid ${colors.borderLight}`,
        }}>
          {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </button>
      ))}
    </div>
  );
}

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(d) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}
