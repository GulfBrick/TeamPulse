import React, { useState, useEffect } from 'react';
import { api } from '../hooks/api';
import { Card, Badge, Btn, StatCard, formatTime, formatDate, todayStr, colors } from '../components/UI';
import DayTimeline from '../components/DayTimeline';

export default function EmployeeDetail({ employeeId, onBack }) {
  const [employee, setEmployee] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [kpis, setKPIs] = useState([]);
  const [standups, setStandups] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listEmployees().then(emps => emps.find(e => e.id === employeeId)),
      api.getEmployeeTimeline(employeeId, date).catch(() => null),
      api.listKPIs().then(kpis => kpis.filter(k => k.user_id === employeeId)).catch(() => []),
      api.listStandups(date).then(su => su.filter(s => s.user?.id === employeeId || s.user_id === employeeId)).catch(() => []),
    ]).then(([emp, tl, k, su]) => {
      setEmployee(emp || null);
      setTimeline(tl);
      setKPIs(k);
      setStandups(su);
      setLoading(false);
    });
  }, [employeeId, date]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: colors.textDim }}>Loading employee details...</div>;
  }

  if (!employee) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>?</div>
        <p style={{ color: colors.textDim }}>Employee not found.</p>
        <Btn variant="secondary" onClick={onBack} style={{ marginTop: '12px' }}>Go Back</Btn>
      </div>
    );
  }

  const agg = timeline?.aggregation;
  const segments = timeline?.segments || [];
  const totalActive = agg?.total_active_seconds || 0;
  const totalIdle = agg?.total_idle_seconds || 0;
  const totalTime = totalActive + totalIdle;
  const activePercent = totalTime > 0 ? Math.round((totalActive / totalTime) * 100) : 0;

  // Parse top apps
  let topApps = [];
  try { topApps = JSON.parse(agg?.top_apps || '[]'); } catch {}

  return (
    <div>
      {/* Back button + Header */}
      <div style={{ marginBottom: '24px' }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer',
          fontSize: '13px', padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '16px' }}>&#8592;</span> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(59,130,246,0.1)', fontSize: '20px', fontWeight: 700, color: colors.accent,
          }}>
            {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: '22px', fontWeight: 800, color: colors.text }}>{employee.name}</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: colors.textDim }}>{employee.title || 'Team Member'}</span>
              <Badge status={employee.is_active ? 'active' : 'clocked-out'} />
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
              padding: '8px 12px', background: colors.bg, border: `1px solid ${colors.borderLight}`,
              borderRadius: '6px', color: colors.textMuted, fontSize: '13px', outline: 'none',
            }} />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard label="Active Time" value={formatTime(totalActive)} accent={colors.green} />
        <StatCard label="Idle Time" value={formatTime(totalIdle)} accent={colors.yellow} />
        <StatCard label="Active %" value={`${activePercent}%`} accent={activePercent >= 80 ? colors.green : activePercent >= 50 ? colors.yellow : colors.red} />
        <StatCard label="Events" value={`${(agg?.total_mouse_clicks || 0) + (agg?.total_keystrokes || 0)}`} accent={colors.accent}
          sub={`${agg?.total_mouse_moves || 0} moves`} />
      </div>

      {/* Day Timeline */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: colors.text, fontWeight: 700 }}>Day Timeline</h3>
        <DayTimeline segments={segments} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* App usage breakdown */}
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: colors.text, fontWeight: 700 }}>App Usage</h3>
          {topApps.length === 0 ? (
            <div style={{ fontSize: '13px', color: colors.textDim, textAlign: 'center', padding: '20px' }}>No app data</div>
          ) : (
            topApps.map((app, i) => {
              const maxDur = topApps[0]?.Duration || 1;
              return (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', color: colors.text }}>{app.AppName}</span>
                    <span style={{ fontSize: '12px', color: colors.textDim }}>{formatTime(app.Duration)}</span>
                  </div>
                  <div style={{ background: colors.bg, borderRadius: '3px', height: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${(app.Duration / maxDur) * 100}%`, height: '100%', borderRadius: '3px', background: colors.accent }} />
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {/* KPIs */}
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: colors.text, fontWeight: 700 }}>KPI Progress</h3>
          {kpis.length === 0 ? (
            <div style={{ fontSize: '13px', color: colors.textDim, textAlign: 'center', padding: '20px' }}>No KPIs assigned</div>
          ) : (
            kpis.map(kpi => {
              const pct = kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 120) : 0;
              const barColor = pct >= 100 ? '#a78bfa' : pct >= 70 ? colors.green : colors.red;
              return (
                <div key={kpi.id} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', color: colors.text }}>{kpi.metric}</span>
                    <span style={{ fontSize: '12px', color: barColor, fontWeight: 600 }}>{kpi.current} / {kpi.target} {kpi.unit}</span>
                  </div>
                  <div style={{ background: colors.bg, borderRadius: '3px', height: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: '3px', background: barColor }} />
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* Feedback history */}
      {standups.length > 0 && (
        <Card>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: colors.text, fontWeight: 700 }}>Feedback ({formatDate(date)})</h3>
          {standups.map(s => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: colors.textDim, fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Accomplishments</div>
                <div style={{ fontSize: '12px', color: colors.textMuted }}>{s.yesterday || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: colors.textDim, fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Tomorrow</div>
                <div style={{ fontSize: '12px', color: colors.textMuted }}>{s.today}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: colors.textDim, fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Blockers</div>
                <div style={{ fontSize: '12px', color: s.blockers ? colors.red : colors.textMuted }}>{s.blockers || 'None'}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
