import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../hooks/api';
import { useActivityTracker } from '../hooks/useActivityTracker';
import { useActivityCheck } from '../hooks/useActivityCheck';
import { Card, Badge, Btn, Input, Modal, EmptyState, StatCard, ActivityCheckModal, formatTime, formatDate, todayStr, colors } from '../components/UI';

export default function EmployeeView() {
  const [clockStatus, setClockStatus] = useState({ clocked_in: false });
  const [tasks, setTasks] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [kpis, setKPIs] = useState([]);
  const [showStandup, setShowStandup] = useState(false);
  const [standupForm, setStandupForm] = useState({ yesterday: '', today: '', blockers: '' });
  const [elapsed, setElapsed] = useState(0);
  const [taskElapsed, setTaskElapsed] = useState(0);
  const [dailyHours, setDailyHours] = useState([]);
  const [tab, setTab] = useState('clock');

  // Activity tracking
  useActivityTracker(clockStatus.clocked_in);

  // Activity check (random popup)
  const { showCheck, countdown, confirmPresence, wasAutoClocked, dismissAutoClockMessage } = useActivityCheck(clockStatus.clocked_in);

  // Load data
  const refresh = useCallback(async () => {
    try {
      const [cs, t, at, k, dh] = await Promise.all([
        api.getClockStatus(),
        api.listTasks(),
        api.getActiveTimer(),
        api.listKPIs(),
        api.getDailyHours(7).catch(() => []),
      ]);
      setClockStatus(cs);
      setTasks(t);
      setActiveTimer(at.active ? at : null);
      setKPIs(k);
      setDailyHours(dh);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Live elapsed timer
  useEffect(() => {
    if (!clockStatus.clocked_in) { setElapsed(0); return; }
    const start = new Date(clockStatus.entry?.clock_in).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [clockStatus]);

  // Task timer elapsed
  useEffect(() => {
    if (!activeTimer?.active) { setTaskElapsed(0); return; }
    const i = setInterval(() => {
      setTaskElapsed(activeTimer.elapsed_seconds + Math.floor((Date.now() - Date.parse(activeTimer.task_time.started_at)) / 1000) - activeTimer.elapsed_seconds);
    }, 1000);
    return () => clearInterval(i);
  }, [activeTimer]);

  // Refresh when auto-clocked out by activity check
  useEffect(() => {
    if (wasAutoClocked) refresh();
  }, [wasAutoClocked, refresh]);

  const handleClock = async () => {
    if (clockStatus.clocked_in) {
      await api.clockOut();
    } else {
      await api.clockIn();
    }
    refresh();
  };

  const handleTaskTimer = async (taskId) => {
    if (activeTimer?.active && activeTimer.task_time.task_id === taskId) {
      await api.stopTaskTimer();
    } else {
      await api.startTaskTimer(taskId);
    }
    refresh();
  };

  const handleStandup = async () => {
    await api.createStandup(standupForm);
    setStandupForm({ yesterday: '', today: '', blockers: '' });
    setShowStandup(false);
  };

  const cycleTask = async (task) => {
    const order = ['pending', 'in_progress', 'complete'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await api.updateTask(task.id, { status: next });
    refresh();
  };

  const priorityColor = { high: '#f87171', medium: '#fbbf24', low: '#34d399' };
  const myTasks = tasks.filter(t => t.status !== 'complete');
  const completedToday = tasks.filter(t => t.status === 'complete');

  return (
    <div>
      {/* Tab selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
        {[['clock', '⏱ Time Clock'], ['tasks', '☑ My Tasks'], ['kpis', '◉ My KPIs']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            background: tab === key ? colors.gradient : 'transparent', color: tab === key ? '#fff' : colors.textDim,
            border: tab === key ? 'none' : `1px solid ${colors.borderLight}`,
          }}>{label}</button>
        ))}
      </div>

      {/* ─── Time Clock ──────────────────────────────────── */}
      {tab === 'clock' && (
        <div>
          <Card style={{
            textAlign: 'center', padding: '48px 32px', marginBottom: '24px',
            border: clockStatus.clocked_in ? '1px solid #065f46' : `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: '13px', color: colors.textDim, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {clockStatus.clocked_in ? 'Clocked In' : 'Not Clocked In'}
            </div>
            <div style={{ fontSize: '48px', fontWeight: 700, color: clockStatus.clocked_in ? '#34d399' : '#64748b', fontVariantNumeric: 'tabular-nums', marginBottom: '24px' }}>
              {clockStatus.clocked_in ? formatTime(elapsed) : '—'}
            </div>
            <Btn variant={clockStatus.clocked_in ? 'danger' : 'success'} onClick={handleClock} style={{ padding: '14px 48px', fontSize: '16px' }}>
              {clockStatus.clocked_in ? '⏹ Clock Out' : '▶ Clock In'}
            </Btn>
          </Card>

          {clockStatus.clocked_in && (
            <Card style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: colors.textDim, marginBottom: '4px' }}>Activity Status</div>
                  <div style={{ fontSize: '14px', color: colors.textMuted }}>
                    Your activity is being tracked while clocked in. Stay active to log your work time accurately.
                  </div>
                </div>
                <Badge status="active" />
              </div>
            </Card>
          )}

          <Btn variant="secondary" onClick={() => setShowStandup(true)} style={{ marginBottom: '16px' }}>
            📝 Log Daily Standup
          </Btn>

          {/* Hours Chart */}
          <Card style={{ marginTop: '8px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: colors.textMuted, fontWeight: 600 }}>My Hours — Last 7 Days</h3>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={(dailyHours || []).map(d => ({
                  ...d,
                  day: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
                  hours: Math.round(d.hours * 10) / 10,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                  <XAxis dataKey="day" tick={{ fill: colors.textDim, fontSize: 12 }} axisLine={{ stroke: colors.border }} tickLine={false} />
                  <YAxis tick={{ fill: colors.textDim, fontSize: 12 }} axisLine={{ stroke: colors.border }} tickLine={false} unit="h" />
                  <Tooltip
                    contentStyle={{ background: colors.card, border: `1px solid ${colors.borderLight}`, borderRadius: '8px', color: colors.text, fontSize: '13px' }}
                    labelStyle={{ color: colors.textMuted }}
                    formatter={(value) => [`${value}h`, 'Hours']}
                  />
                  <defs>
                    <linearGradient id="empBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="hours" fill="url(#empBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Tasks ───────────────────────────────────────── */}
      {tab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <StatCard label="Active Tasks" value={myTasks.length} accent="#60a5fa" />
            <StatCard label="Completed" value={completedToday.length} accent="#34d399" sub="all time" />
          </div>

          {myTasks.length === 0 ? (
            <EmptyState icon="☑" message="No active tasks assigned to you." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myTasks.map(task => {
                const isTimerActive = activeTimer?.active && activeTimer.task_time?.task_id === task.id;
                const totalTime = (task.task_times || []).reduce((sum, tt) => sum + (tt.duration_seconds || 0), 0);
                return (
                  <Card key={task.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: isTimerActive ? '1px solid #065f46' : undefined,
                  }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => cycleTask(task)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColor[task.priority] }} />
                        <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text }}>{task.title}</span>
                        <Badge status={task.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textDim, marginLeft: '18px' }}>
                        Time logged: {formatTime(totalTime)}
                        {task.due_date && ` · Due ${formatDate(task.due_date)}`}
                      </div>
                    </div>
                    {clockStatus.clocked_in && (
                      <Btn
                        variant={isTimerActive ? 'danger' : 'secondary'}
                        onClick={() => handleTaskTimer(task.id)}
                        style={{ padding: '8px 14px', fontSize: '12px' }}
                      >
                        {isTimerActive ? '⏹ Stop' : '▶ Start'}
                      </Btn>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── KPIs ────────────────────────────────────────── */}
      {tab === 'kpis' && (
        <div>
          {kpis.length === 0 ? (
            <EmptyState icon="📊" message="No KPIs assigned to you yet." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {kpis.map(kpi => {
                const pct = kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 120) : 0;
                const barColor = pct >= 100 ? '#a78bfa' : pct >= 70 ? '#34d399' : '#f87171';
                return (
                  <Card key={kpi.id}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>{kpi.metric}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 700, color: barColor }}>{kpi.current}</span>
                      <span style={{ fontSize: '14px', color: colors.textDim }}>/ {kpi.target} {kpi.unit}</span>
                    </div>
                    <div style={{ background: colors.bg, borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '12px', color: colors.textDimmer, marginTop: '8px' }}>{Math.round(pct)}% of target</div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Standup Modal ───────────────────────────────── */}
      {showStandup && (
        <Modal title="Daily Standup" onClose={() => setShowStandup(false)}>
          <Input label="What did you do yesterday?" type="textarea" value={standupForm.yesterday} onChange={e => setStandupForm({ ...standupForm, yesterday: e.target.value })} placeholder="Completed tasks..." />
          <Input label="What are you working on today?" type="textarea" value={standupForm.today} onChange={e => setStandupForm({ ...standupForm, today: e.target.value })} placeholder="Today's plan..." />
          <Input label="Any blockers?" type="textarea" value={standupForm.blockers} onChange={e => setStandupForm({ ...standupForm, blockers: e.target.value })} placeholder="Issues (optional)" />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Btn variant="secondary" onClick={() => setShowStandup(false)}>Cancel</Btn>
            <Btn onClick={handleStandup}>Submit</Btn>
          </div>
        </Modal>
      )}

      {/* ─── Activity Check Modal ──────────────────────── */}
      {showCheck && (
        <ActivityCheckModal countdown={countdown} onConfirm={confirmPresence} />
      )}

      {/* ─── Auto Clock-Out Notification ───────────────── */}
      {wasAutoClocked && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: colors.card, border: `1px solid ${colors.red}`, borderRadius: '12px',
          padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 9000,
        }} className="fade-in">
          <span style={{ fontSize: '20px' }}>⏹</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: colors.red }}>Auto Clocked Out</div>
            <div style={{ fontSize: '12px', color: colors.textDim }}>You were clocked out due to inactivity.</div>
          </div>
          <button onClick={dismissAutoClockMessage} style={{
            background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', fontSize: '16px', marginLeft: '8px',
          }}>✕</button>
        </div>
      )}
    </div>
  );
}
