import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/api';
import { useActivityTracker } from '../hooks/useActivityTracker';
import { Card, Badge, Btn, Input, Modal, EmptyState, StatCard, formatTime, formatDate, todayStr } from '../components/UI';

export default function EmployeeView() {
  const [clockStatus, setClockStatus] = useState({ clocked_in: false });
  const [tasks, setTasks] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [kpis, setKPIs] = useState([]);
  const [showStandup, setShowStandup] = useState(false);
  const [standupForm, setStandupForm] = useState({ yesterday: '', today: '', blockers: '' });
  const [elapsed, setElapsed] = useState(0);
  const [taskElapsed, setTaskElapsed] = useState(0);
  const [tab, setTab] = useState('clock');

  // Activity tracking
  useActivityTracker(clockStatus.clocked_in);

  // Load data
  const refresh = useCallback(async () => {
    try {
      const [cs, t, at, k] = await Promise.all([
        api.getClockStatus(),
        api.listTasks(),
        api.getActiveTimer(),
        api.listKPIs(),
      ]);
      setClockStatus(cs);
      setTasks(t);
      setActiveTimer(at.active ? at : null);
      setKPIs(k);
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
            background: tab === key ? '#3b82f6' : 'transparent', color: tab === key ? '#fff' : '#64748b',
            border: tab === key ? 'none' : '1px solid #2a2a3a',
          }}>{label}</button>
        ))}
      </div>

      {/* ─── Time Clock ──────────────────────────────────── */}
      {tab === 'clock' && (
        <div>
          <Card style={{
            textAlign: 'center', padding: '48px 32px', marginBottom: '24px',
            border: clockStatus.clocked_in ? '1px solid #065f46' : '1px solid #1e1e2e',
          }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
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
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Activity Status</div>
                  <div style={{ fontSize: '14px', color: '#94a3b8' }}>
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
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#f1f5f9' }}>{task.title}</span>
                        <Badge status={task.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginLeft: '18px' }}>
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
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' }}>{kpi.metric}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 700, color: barColor }}>{kpi.current}</span>
                      <span style={{ fontSize: '14px', color: '#64748b' }}>/ {kpi.target} {kpi.unit}</span>
                    </div>
                    <div style={{ background: '#0d0d17', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: '4px', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px' }}>{Math.round(pct)}% of target</div>
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
    </div>
  );
}
