import React from 'react';

// ─── Brand Colors ─────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg: '#06060e',
  bgRaised: '#0a0a16',
  card: '#0f0f1c',
  cardHover: '#141428',
  // Borders
  border: '#1a1a2e',
  borderLight: '#252540',
  borderAccent: '#22d3ee33',
  // Text
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  textDimmer: '#475569',
  // Brand gradient endpoints
  cyan: '#22d3ee',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  // Semantic
  green: '#34d399',
  red: '#f87171',
  yellow: '#fbbf24',
  // Gradient strings
  gradient: 'linear-gradient(135deg, #22d3ee, #3b82f6, #8b5cf6)',
  gradientSubtle: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(139,92,246,0.12))',
};

const badgeColors = {
  'clocked-in': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'clocked-out': { bg: '#1a1a2e', text: '#94a3b8', border: '#334155' },
  'complete': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'in_progress': { bg: '#0c1a2e', text: '#22d3ee', border: '#164e63' },
  'pending': { bg: '#2d2006', text: '#fbbf24', border: '#4a3500' },
  'overdue': { bg: '#3b1010', text: '#f87171', border: '#5c1a1a' },
  'on-track': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'behind': { bg: '#3b1010', text: '#f87171', border: '#5c1a1a' },
  'exceeded': { bg: '#1a0d33', text: '#a78bfa', border: '#2e1065' },
  'active': { bg: '#0d3320', text: '#34d399', border: '#065f46' },
  'idle': { bg: '#2d2006', text: '#fbbf24', border: '#4a3500' },
};

// ─── Logo ─────────────────────────────────────────────────────

export function Logo({ size = 40, glow = false }) {
  const id = `logo-grad-${size}`;
  const glowId = `logo-glow-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        {glow && (
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      {/* Rounded square background */}
      <rect x="4" y="4" width="92" height="92" rx="20" fill="#0a0a18" stroke={`url(#${id})`} strokeWidth="2.5" />
      {/* T letter - top bar */}
      <rect x="22" y="20" width="56" height="8" rx="4" fill={`url(#${id})`} />
      {/* T letter - vertical stem */}
      <rect x="46" y="20" width="8" height="22" rx="2" fill={`url(#${id})`} />
      {/* Heartbeat pulse line through the middle */}
      <polyline
        points="16,58 32,58 38,58 42,42 48,72 54,38 58,65 62,52 66,58 84,58"
        stroke={`url(#${id})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter={glow ? `url(#${glowId})` : undefined}
      />
      {/* T letter - bottom of stem below pulse */}
      <rect x="46" y="68" width="8" height="14" rx="2" fill={`url(#${id})`} />
    </svg>
  );
}

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

export function StatCard({ label, value, sub, accent = colors.cyan, icon }) {
  return (
    <Card style={{
      flex: '1 1 200px', position: 'relative', overflow: 'hidden',
      borderLeft: `3px solid ${accent}`,
      background: `linear-gradient(135deg, ${colors.card}, ${colors.card}ee)`,
    }}>
      {/* Subtle glow in corner */}
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px',
        background: `radial-gradient(circle, ${accent}15, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', color: colors.textDim, marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '12px', color: colors.textDimmer, marginTop: '6px' }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: '28px', opacity: 0.6 }}>{icon}</div>}
      </div>
    </Card>
  );
}

export function Btn({ children, variant = 'primary', style, ...props }) {
  const styles = {
    primary: { background: colors.gradient, color: '#fff', border: 'none' },
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
    transition: 'border-color 0.2s, box-shadow 0.2s',
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div className="fade-in" style={{
        background: colors.card, borderRadius: '16px', padding: '32px', width: '480px',
        maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
        border: `1px solid ${colors.borderLight}`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: colors.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: '20px' }}>&#x2715;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, message, sub }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 20px', color: colors.textDimmer,
      background: `radial-gradient(ellipse at center, ${colors.card}80, transparent 70%)`,
      borderRadius: '16px',
    }}>
      <div style={{ fontSize: '56px', marginBottom: '16px', filter: 'grayscale(0.3)' }}>{icon}</div>
      <p style={{ fontSize: '15px', color: colors.textDim, fontWeight: 500 }}>{message}</p>
      {sub && <p style={{ fontSize: '13px', color: colors.textDimmer, marginTop: '8px' }}>{sub}</p>}
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

export function ActivityCheckModal({ countdown, onConfirm }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(12px)',
    }}>
      <div className="fade-in" style={{
        background: colors.card, borderRadius: '20px', padding: '48px', width: '420px',
        maxWidth: '90vw', textAlign: 'center',
        border: `1px solid ${colors.borderLight}`, boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }} onClick={e => e.stopPropagation()}>
        {/* Pulsing alert icon */}
        <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'activity-pulse 1.5s ease-in-out infinite' }}>
          ⚠️
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: colors.text, fontWeight: 700 }}>
          Are you still working?
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.textDim }}>
          Please confirm your presence to stay clocked in.
        </p>

        {/* Countdown ring */}
        <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 28px' }}>
          <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="44" fill="none" stroke={colors.border} strokeWidth="6" />
            <circle cx="50" cy="50" r="44" fill="none"
              stroke={countdown > 15 ? colors.cyan : colors.red}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - countdown / 60)}`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 700, color: countdown > 15 ? colors.text : colors.red,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {countdown}
          </div>
        </div>

        <button onClick={onConfirm} style={{
          width: '100%', padding: '16px 32px', borderRadius: '12px', fontSize: '18px',
          fontWeight: 700, cursor: 'pointer', color: '#fff', border: 'none',
          background: colors.gradient, boxShadow: '0 4px 24px rgba(34,211,238,0.3)',
        }}>
          I'm Here
        </button>

        <p style={{ margin: '16px 0 0', fontSize: '12px', color: colors.textDimmer }}>
          You'll be automatically clocked out if you don't respond.
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar Navigation ──────────────────────────────────────

const sidebarIcons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  team: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  timeline: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="12" x2="22" y2="12" /><line x1="6" y1="8" x2="6" y2="16" /><line x1="12" y1="6" x2="12" y2="18" /><line x1="18" y1="8" x2="18" y2="16" />
    </svg>
  ),
  tasks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  kpis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  standups: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  monitoring: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  time: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

export function Sidebar({ items, active, onSelect, user, onLogout }) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div style={{
      width: collapsed ? '60px' : '220px',
      minHeight: '100vh',
      background: colors.card,
      borderRight: `1px solid ${colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '16px 12px' : '20px 20px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <Logo size={32} />
        {!collapsed && (
          <span style={{
            fontSize: '14px', fontWeight: 700, letterSpacing: '-0.3px',
            background: colors.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>TeamPulse</span>
        )}
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)} style={{
        position: 'absolute', top: '28px', right: '-12px', width: '24px', height: '24px',
        borderRadius: '50%', background: colors.card, border: `1px solid ${colors.border}`,
        color: colors.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', zIndex: 10,
      }}>
        {collapsed ? '▸' : '◂'}
      </button>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map(item => {
          const isActive = active === item.key;
          return (
            <button key={item.key} onClick={() => onSelect(item.key)} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: isActive ? 'rgba(34,211,238,0.1)' : 'transparent',
              color: isActive ? colors.cyan : colors.textDim,
              fontSize: '13px', fontWeight: isActive ? 600 : 500,
              transition: 'all 0.15s',
              position: 'relative',
              width: '100%',
              textAlign: 'left',
            }}>
              {/* Accent bar */}
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0, top: '6px', bottom: '6px', width: '3px',
                  borderRadius: '0 3px 3px 0',
                  background: colors.gradient,
                }} />
              )}
              <span style={{ display: 'flex', flexShrink: 0 }}>{sidebarIcons[item.key] || sidebarIcons.dashboard}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User profile + logout */}
      <div style={{
        padding: collapsed ? '12px 8px' : '16px 16px',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: collapsed ? 'center' : 'flex-start',
        flexDirection: collapsed ? 'column' : 'row',
        gap: '8px',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: '10px', color: colors.textDimmer, textTransform: 'uppercase' }}>
              {user?.role || 'employee'}
            </div>
          </div>
        )}
        <button onClick={onLogout} title="Sign Out" style={{
          background: 'none', border: `1px solid ${colors.borderLight}`, borderRadius: '6px',
          padding: '4px 8px', cursor: 'pointer', color: colors.textDim, fontSize: '11px',
          flexShrink: 0,
        }}>
          {collapsed ? '⏻' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}

export function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{
          padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
          background: active === t ? colors.gradient : 'transparent',
          color: active === t ? '#fff' : colors.textDim,
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
