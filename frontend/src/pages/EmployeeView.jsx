import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../hooks/api';
import { useActivityTracker } from '../hooks/useActivityTracker';
// import { useActivityCheck } from '../hooks/useActivityCheck'; // Disabled
import { Card, Badge, Btn, Input, Modal, EmptyState, StatCard, formatTime, formatDate, todayStr, colors } from '../components/UI';
import DayTimeline from '../components/DayTimeline';

export default function EmployeeView({ section }) {
  const [clockStatus, setClockStatus] = useState({ clocked_in: false });
  const [tasks, setTasks] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [kpis, setKPIs] = useState([]);
  const [showStandup, setShowStandup] = useState(false);
  const [standupForm, setStandupForm] = useState({ yesterday: '', today: '', blockers: '' });
  const [showClockOutFeedback, setShowClockOutFeedback] = useState(false);
  const [clockOutForm, setClockOutForm] = useState({ yesterday: '', today: '', blockers: '' });

  // Leave state
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', days: 1, reason: '', sick_note: '' });
  const [sickNoteFile, setSickNoteFile] = useState(null);
  const [sickNotePreview, setSickNotePreview] = useState(null);
  const [uploadingNote, setUploadingNote] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [taskElapsed, setTaskElapsed] = useState(0);
  const [dailyHours, setDailyHours] = useState([]);
  const [mySegments, setMySegments] = useState([]);
  const [segmentDate, setSegmentDate] = useState(todayStr());
  const [mySessions, setMySessions] = useState([]);
  const [sessionDate, setSessionDate] = useState(todayStr());
  const [expandedSession, setExpandedSession] = useState(null);
  const tab = section || 'clock';

  // Agent onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [setupCode, setSetupCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [agentVersion, setAgentVersion] = useState(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showSetupKeyModal, setShowSetupKeyModal] = useState(false);
  const [selfSetupCode, setSelfSetupCode] = useState('');
  const [selfSetupLoading, setSelfSetupLoading] = useState(false);
  const [selfSetupExpiry, setSelfSetupExpiry] = useState(null);

  // Activity tracking
  useActivityTracker(clockStatus.clocked_in);

  // Activity check disabled
  // const { showCheck, countdown, confirmPresence, wasAutoClocked, dismissAutoClockMessage } = useActivityCheck(clockStatus.clocked_in);

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

  // Load segments for My Timeline
  useEffect(() => {
    if (tab !== 'timeline') return;
    api.getMySegments(segmentDate).then(setMySegments).catch(() => setMySegments([]));
  }, [tab, segmentDate]);

  // Load sessions for My Sessions
  useEffect(() => {
    if (tab !== 'sessions') return;
    api.getMyClockSessions(sessionDate).then(setMySessions).catch(() => setMySessions([]));
  }, [tab, sessionDate]);

  // Load leave data
  useEffect(() => {
    if (tab !== 'leave') return;
    Promise.all([
      api.getLeaveBalance().catch(() => null),
      api.getMyLeave().catch(() => []),
    ]).then(([bal, leaves]) => {
      setLeaveBalance(bal);
      setMyLeaves(leaves);
    });
  }, [tab]);

  // Check agent setup status on mount — show onboarding if not done
  useEffect(() => {
    if (api.user && !api.user.agent_setup_done) {
      setShowOnboarding(true);
      return;
    }
    api.getAgentStatus().then(status => {
      if (!status.agent_setup_done) {
        setShowOnboarding(true);
      }
    }).catch(() => {
      if (!api.user?.agent_setup_done) {
        setShowOnboarding(true);
      }
    });
  }, []);

  // Check for agent updates
  useEffect(() => {
    api.getAgentVersion().then(data => {
      setAgentVersion(data);
      // Check local storage for last dismissed version
      const dismissedVersion = localStorage.getItem('tp_dismissed_agent_version');
      if (data.version && dismissedVersion !== data.version) {
        // Show update banner if user has completed setup (agent might be outdated)
        if (api.user?.agent_setup_done) {
          setShowUpdateBanner(true);
        }
      }
    }).catch(() => {});
  }, []);

  const dismissUpdateBanner = () => {
    if (agentVersion?.version) {
      localStorage.setItem('tp_dismissed_agent_version', agentVersion.version);
    }
    setShowUpdateBanner(false);
  };

  const startAgentDownload = async () => {
    setOnboardingStep(2);
    const link = document.createElement('a');
    link.href = '/api/agent/download';
    link.download = 'TeamPulseAgent-Setup.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCode = async () => {
    setSetupLoading(true);
    try {
      const result = await api.generateSetupToken();
      setSetupCode(result.code);
      setOnboardingStep(3);
    } catch (err) {
      console.error(err);
    }
    setSetupLoading(false);
  };

  const generateSelfSetupKey = async () => {
    setSelfSetupLoading(true);
    try {
      const result = await api.generateSetupToken();
      setSelfSetupCode(result.code);
      setSelfSetupExpiry(result.expires_at);
      setShowSetupKeyModal(true);
    } catch (err) {
      console.error(err);
    }
    setSelfSetupLoading(false);
  };

  const finishOnboarding = async () => {
    await api.skipAgentSetup().catch(() => {});
    setShowOnboarding(false);
  };

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

  // Refresh when auto-clocked out by activity check (disabled)
  // useEffect(() => {
  //   if (wasAutoClocked) refresh();
  // }, [wasAutoClocked, refresh]);

  const handleClock = async () => {
    if (clockStatus.clocked_in) {
      // Show feedback modal before clocking out
      setClockOutForm({ yesterday: '', today: '', blockers: '' });
      setShowClockOutFeedback(true);
      return;
    }
    await api.clockIn();
    refresh();
  };

  const handleClockOutSubmit = async () => {
    // Submit feedback as a standup, then clock out
    if (clockOutForm.yesterday || clockOutForm.today) {
      await api.createStandup(clockOutForm).catch(() => {});
    }
    await api.clockOut();
    setShowClockOutFeedback(false);
    refresh();
  };

  const handleClockOutSkip = async () => {
    await api.clockOut();
    setShowClockOutFeedback(false);
    refresh();
  };

  const handleApplyLeave = async () => {
    let sickNoteUrl = '';
    if (sickNoteFile && leaveForm.leave_type === 'sick') {
      setUploadingNote(true);
      try {
        const result = await api.uploadFile(sickNoteFile);
        sickNoteUrl = result.url;
      } catch (err) {
        alert('Failed to upload sick note photo: ' + err.message);
        setUploadingNote(false);
        return;
      }
      setUploadingNote(false);
    }
    await api.applyLeave({ ...leaveForm, sick_note: sickNoteUrl });
    setShowLeaveForm(false);
    setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', days: 1, reason: '', sick_note: '' });
    setSickNoteFile(null);
    setSickNotePreview(null);
    // Refresh leave data
    const [bal, leaves] = await Promise.all([
      api.getLeaveBalance().catch(() => null),
      api.getMyLeave().catch(() => []),
    ]);
    setLeaveBalance(bal);
    setMyLeaves(leaves);
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

  const priorityColor = { high: colors.red, medium: colors.yellow, low: colors.green };
  const myTasks = tasks.filter(t => t.status !== 'complete');
  const completedToday = tasks.filter(t => t.status === 'complete');

  return (
    <div>
      {/* ─── Update Notification Banner ───────────────────── */}
      {showUpdateBanner && agentVersion && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🚀</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text, marginBottom: '2px' }}>
                Desktop Agent Update Available!
              </div>
              <div style={{ fontSize: '12px', color: colors.textDim }}>
                Version {agentVersion.version} is ready. Download now for improved activity tracking.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <a
              href="/api/agent/download"
              download="TeamPulseAgent-Setup.exe"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                background: colors.accent,
                color: '#fff',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              ⬇ Download v{agentVersion.version}
            </a>
            <button
              onClick={dismissUpdateBanner}
              style={{
                background: 'transparent',
                border: `1px solid ${colors.borderLight}`,
                borderRadius: '8px',
                padding: '10px 14px',
                color: colors.textDim,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ─── Time Clock ──────────────────────────────────── */}
      {tab === 'clock' && (
        <div>
          {/* Welcome greeting */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: colors.text }}>
              {clockStatus.clocked_in ? "You're on the clock" : `Ready to start, ${api.user?.name?.split(' ')[0] || 'champ'}?`}
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: colors.textDim }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <Card style={{
            textAlign: 'center', padding: '48px 32px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
            border: clockStatus.clocked_in ? `1px solid rgba(34,197,94,0.3)` : `1px solid ${colors.border}`,
            background: clockStatus.clocked_in
              ? 'linear-gradient(180deg, rgba(34,197,94,0.06), #16171f)'
              : colors.card,
          }}>
            <div>
              <div style={{
                fontSize: '12px', color: clockStatus.clocked_in ? colors.green : colors.textDim,
                marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700,
              }}>
                {clockStatus.clocked_in ? '● Session Active' : 'Ready to Clock In'}
              </div>
              <div style={{
                fontSize: '56px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginBottom: '28px', lineHeight: 1,
                color: clockStatus.clocked_in ? colors.green : colors.textDimmer,
              }}>
                {clockStatus.clocked_in ? formatTime(elapsed) : '0h 0m'}
              </div>
              <Btn
                variant={clockStatus.clocked_in ? 'danger' : 'success'}
                onClick={handleClock}
                style={{
                  padding: '16px 56px', fontSize: '16px', fontWeight: 700, borderRadius: '12px',
                }}
              >
                {clockStatus.clocked_in ? '⏹ Clock Out' : '▶ Clock In'}
              </Btn>
            </div>
          </Card>

          {clockStatus.clocked_in && (
            <Card style={{
              marginBottom: '24px', borderLeft: `3px solid ${colors.green}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', color: colors.green, marginBottom: '4px', fontWeight: 600 }}>Activity Tracking Active</div>
                  <div style={{ fontSize: '13px', color: colors.textDim }}>
                    Stay active and you'll get occasional check-ins to confirm you're here.
                  </div>
                </div>
                <Badge status="active" />
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <Btn variant="secondary" onClick={() => setShowStandup(true)}>
              📝 Daily Feedback
            </Btn>
            <Btn variant="secondary" onClick={generateSelfSetupKey} disabled={selfSetupLoading}>
              {selfSetupLoading ? '⏳ Generating...' : '🔑 Setup Key'}
            </Btn>
            <a
              href="/api/agent/download"
              download="TeamPulseAgent-Setup.exe"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                background: 'transparent',
                border: `1px solid ${colors.borderLight}`,
                borderRadius: '8px',
                color: colors.textMuted,
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.target.style.borderColor = colors.accent; e.target.style.color = colors.accent; }}
              onMouseOut={e => { e.target.style.borderColor = colors.borderLight; e.target.style.color = colors.textMuted; }}
            >
              ⬇ Download Agent
            </a>
          </div>

          {/* Hours Chart */}
          <Card style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: colors.text, fontWeight: 700 }}>My Hours</h3>
                <p style={{ margin: 0, fontSize: '12px', color: colors.textDim }}>Last 7 days</p>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                background: 'rgba(59,130,246,0.1)', color: colors.accent, border: '1px solid rgba(59,130,246,0.2)',
              }}>
                {(dailyHours || []).reduce((sum, d) => sum + (d.hours || 0), 0).toFixed(1)}h total
              </div>
            </div>
            {(dailyHours || []).every(d => !d.hours || d.hours === 0) ? (
              <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px', opacity: 0.5 }}>📈</div>
                <p style={{ color: colors.textDim, fontSize: '13px', margin: 0 }}>Clock in to start building your week's hours.</p>
              </div>
            ) : (
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={(dailyHours || []).map(d => ({
                    ...d,
                    day: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
                    hours: Math.round(d.hours * 10) / 10,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: colors.textDim, fontSize: 12 }} axisLine={{ stroke: colors.border }} tickLine={false} />
                    <YAxis tick={{ fill: colors.textDim, fontSize: 12 }} axisLine={false} tickLine={false} unit="h" />
                    <Tooltip
                      contentStyle={{ background: colors.card, border: `1px solid ${colors.borderLight}`, borderRadius: '10px', color: colors.text, fontSize: '13px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                      labelStyle={{ color: colors.textMuted, fontWeight: 600 }}
                      formatter={(value) => [`${value}h`, 'Hours']}
                      cursor={{ fill: 'rgba(59,130,246,0.06)' }}
                    />
                    <Bar dataKey="hours" fill={colors.accent} radius={[6, 6, 0, 0]} maxBarSize={52} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── My Sessions ─────────────────────────────────── */}
      {tab === 'sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.text }}>My Sessions</h2>
            <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={{
              padding: '8px 12px', background: colors.bg, border: `1px solid ${colors.borderLight}`,
              borderRadius: '6px', color: colors.textMuted, fontSize: '13px', outline: 'none',
            }} />
          </div>

          {(mySessions || []).length === 0 ? (
            <EmptyState icon="⏱" message={`No sessions for ${formatDate(sessionDate)}.`} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mySessions.map((sess, idx) => {
                const entry = sess.time_entry;
                const isExpanded = expandedSession === idx;
                const duration = entry.duration_seconds || (entry.clock_out ? 0 : Math.floor((Date.now() - new Date(entry.clock_in).getTime()) / 1000));
                return (
                  <Card key={entry.id} style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '16px' : 0 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
                            {new Date(entry.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {entry.clock_out
                              ? new Date(entry.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                              : 'now'}
                          </span>
                          {!entry.clock_out && <Badge status="clocked-in" />}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textDim, marginTop: '2px' }}>
                          {formatTime(duration)} total · {formatTime(sess.total_active_seconds)} active · {formatTime(sess.total_idle_seconds)} idle
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: colors.textDim }}>
                          <div>{sess.total_mouse_clicks} clicks · {sess.total_keystrokes} keys</div>
                        </div>
                        <button onClick={() => setExpandedSession(isExpanded ? null : idx)} style={{
                          background: 'none', border: `1px solid ${colors.borderLight}`, borderRadius: '6px',
                          padding: '4px 10px', cursor: 'pointer', color: colors.textDim, fontSize: '11px',
                        }}>
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div>
                        {/* Top apps */}
                        {(sess.top_apps || []).length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textDim, marginBottom: '8px' }}>Top Apps</div>
                            {sess.top_apps.map((app, i) => {
                              const maxDur = sess.top_apps[0]?.duration || 1;
                              return (
                                <div key={i} style={{ marginBottom: '6px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '12px', color: colors.text }}>{app.app_name}</span>
                                    <span style={{ fontSize: '11px', color: colors.textDim }}>{formatTime(app.duration)}</span>
                                  </div>
                                  <div style={{ background: colors.bg, borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(app.duration / maxDur) * 100}%`, height: '100%', borderRadius: '3px', background: colors.accent }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Timeline */}
                        <DayTimeline segments={sess.segments || []} />

                        {/* Segment detail table */}
                        {(sess.segments || []).length > 0 && (
                          <div style={{ marginTop: '16px', maxHeight: '300px', overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                                  {['Time', 'Type', 'App', 'Duration', 'Clicks', 'Keys'].map(h => (
                                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: colors.textDim, fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sess.segments.map((seg, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                    <td style={{ padding: '6px 10px', color: colors.textMuted }}>
                                      {new Date(seg.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                      {' — '}
                                      {new Date(seg.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '6px 10px' }}>
                                      <Badge status={seg.segment_type} />
                                    </td>
                                    <td style={{ padding: '6px 10px', color: colors.text }}>{seg.app_name || '—'}</td>
                                    <td style={{ padding: '6px 10px', color: colors.accent, fontWeight: 500 }}>{formatTime(seg.duration_seconds)}</td>
                                    <td style={{ padding: '6px 10px', color: colors.textMuted }}>{seg.mouse_clicks}</td>
                                    <td style={{ padding: '6px 10px', color: colors.textMuted }}>{seg.keystrokes}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── My Timeline ────────────────────────────────── */}
      {tab === 'timeline' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.text }}>My Timeline</h2>
            <input type="date" value={segmentDate} onChange={e => setSegmentDate(e.target.value)} style={{
              padding: '8px 12px', background: colors.bg, border: `1px solid ${colors.borderLight}`,
              borderRadius: '6px', color: colors.textMuted, fontSize: '13px', outline: 'none',
            }} />
          </div>

          <Card style={{ marginBottom: '20px' }}>
            <DayTimeline segments={mySegments} />
          </Card>

          {/* Activity Detail Table */}
          {mySegments.length > 0 && (
            <Card style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: colors.text, fontWeight: 700 }}>Activity Detail ({formatDate(segmentDate)})</h3>
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                      {['Time', 'Type', 'App / Window', 'Duration', 'Clicks', 'Keys', 'Moves'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: colors.textDim, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', position: 'sticky', top: 0, background: colors.card }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mySegments.map((seg, i) => {
                      const start = new Date(seg.start_time);
                      const end = new Date(seg.end_time);
                      const fmt = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const typeColor = seg.segment_type === 'active' ? colors.green : seg.segment_type === 'idle' ? colors.yellow : colors.accent;
                      return (
                        <tr key={seg.id || i} style={{ borderBottom: `1px solid ${colors.borderLight}20` }}>
                          <td style={{ padding: '6px 10px', color: colors.textMuted, whiteSpace: 'nowrap' }}>{fmt(start)} — {fmt(end)}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: `${typeColor}22`, color: typeColor, textTransform: 'capitalize' }}>
                              {seg.segment_type}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', color: colors.text, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {seg.app_name || '—'}
                            {seg.window_title && <span style={{ color: colors.textDim, marginLeft: '6px' }}>— {seg.window_title}</span>}
                          </td>
                          <td style={{ padding: '6px 10px', color: colors.textMuted }}>{formatTime(seg.duration_seconds || 0)}</td>
                          <td style={{ padding: '6px 10px', color: colors.textMuted }}>{seg.mouse_clicks || 0}</td>
                          <td style={{ padding: '6px 10px', color: colors.textMuted }}>{seg.keystrokes || 0}</td>
                          <td style={{ padding: '6px 10px', color: colors.textMuted }}>{seg.mouse_moves || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* App usage breakdown */}
          {mySegments.length > 0 && (
            <Card>
              <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: colors.text, fontWeight: 700 }}>App Usage</h3>
              {(() => {
                const appMap = {};
                mySegments.filter(s => s.segment_type === 'active' && s.app_name).forEach(s => {
                  appMap[s.app_name] = (appMap[s.app_name] || 0) + (s.duration_seconds || 0);
                });
                const apps = Object.entries(appMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
                const maxDur = apps[0]?.[1] || 1;
                return apps.map(([name, dur]) => (
                  <div key={name} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', color: colors.text }}>{name}</span>
                      <span style={{ fontSize: '12px', color: colors.textDim }}>{formatTime(dur)}</span>
                    </div>
                    <div style={{ background: colors.bg, borderRadius: '3px', height: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${(dur / maxDur) * 100}%`, height: '100%', borderRadius: '3px', background: colors.accent }} />
                    </div>
                  </div>
                ));
              })()}
            </Card>
          )}

          {mySegments.length === 0 && (
            <EmptyState icon="📊" message="No timeline data for this date." sub="Activity data appears here while you are clocked in. Try changing the date if you worked on a different day." />
          )}
        </div>
      )}

      {/* ─── Tasks ───────────────────────────────────────── */}
      {tab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <StatCard label="Active Tasks" value={myTasks.length} accent={colors.accentLight} />
            <StatCard label="Completed" value={completedToday.length} accent={colors.green} sub="all time" />
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
                    border: isTimerActive ? `1px solid rgba(34,197,94,0.3)` : undefined,
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
                const barColor = pct >= 100 ? '#a78bfa' : pct >= 70 ? colors.green : colors.red;
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

      {/* ─── Leave ─────────────────────────────────────── */}
      {tab === 'leave' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: colors.text }}>Leave</h2>
            <Btn onClick={() => setShowLeaveForm(true)}>+ Request Leave</Btn>
          </div>

          {/* Balance cards */}
          {leaveBalance && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
              <StatCard label="Available" value={`${leaveBalance.available_days.toFixed(1)}d`} accent={colors.green} />
              <StatCard label="Accrued" value={`${leaveBalance.accrued_days.toFixed(1)}d`} accent={colors.accent} sub={`${leaveBalance.total_days_worked} days worked`} />
              <StatCard label="Used" value={`${leaveBalance.used_days.toFixed(1)}d`} accent={colors.yellow} />
              {leaveBalance.pending_days > 0 && (
                <StatCard label="Pending" value={`${leaveBalance.pending_days.toFixed(1)}d`} accent={colors.red} />
              )}
            </div>
          )}

          <Card style={{ marginBottom: '16px', padding: '16px 20px', borderLeft: `3px solid ${colors.accent}` }}>
            <div style={{ fontSize: '13px', color: colors.textDim }}>
              You accrue <strong style={{ color: colors.text }}>1.5 days</strong> of annual leave for every <strong style={{ color: colors.text }}>30 days</strong> worked.
            </div>
          </Card>

          {/* Leave history */}
          {myLeaves.length === 0 ? (
            <EmptyState icon="🏖" message="No leave requests yet." sub="Click '+ Request Leave' to apply for annual leave or report sick leave." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {myLeaves.map(leave => {
                const statusColor = leave.status === 'approved' ? colors.green : leave.status === 'rejected' ? colors.red : colors.yellow;
                return (
                  <Card key={leave.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>
                          {leave.leave_type === 'sick' ? 'Sick Leave' : 'Annual Leave'}
                        </span>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                          background: `${statusColor}22`, color: statusColor, textTransform: 'uppercase',
                        }}>
                          {leave.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textDim }}>
                        {formatDate(leave.start_date)} — {formatDate(leave.end_date)} ({leave.days} day{leave.days !== 1 ? 's' : ''})
                      </div>
                      {leave.reason && <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '2px' }}>{leave.reason}</div>}
                      {leave.sick_note && (
                        <div style={{ marginTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: colors.textDim, fontWeight: 600 }}>Doctor's Note:</span>
                          <img src={leave.sick_note} alt="Sick note" style={{ display: 'block', maxWidth: '200px', maxHeight: '150px', borderRadius: '6px', marginTop: '4px', cursor: 'pointer', border: `1px solid ${colors.borderLight}` }} onClick={() => window.open(leave.sick_note, '_blank')} />
                        </div>
                      )}
                      {leave.review_notes && <div style={{ fontSize: '12px', color: colors.textDim, marginTop: '4px', fontStyle: 'italic' }}>Admin: {leave.review_notes}</div>}
                    </div>
                    {leave.status === 'pending' && (
                      <Btn variant="secondary" onClick={async () => {
                        await api.cancelLeave(leave.id);
                        setMyLeaves(myLeaves.filter(l => l.id !== leave.id));
                        api.getLeaveBalance().then(setLeaveBalance).catch(() => {});
                      }} style={{ fontSize: '12px', padding: '6px 12px' }}>
                        Cancel
                      </Btn>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Leave Request Modal ─────────────────────────── */}
      {showLeaveForm && (
        <Modal title="Request Leave" onClose={() => setShowLeaveForm(false)}>
          <Input label="Type" type="select" value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
            <option value="annual">Annual Leave</option>
            <option value="sick">Sick Leave</option>
          </Input>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><Input label="Start Date" type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} /></div>
            <div style={{ flex: 1 }}><Input label="End Date" type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} /></div>
            <div style={{ width: '80px' }}><Input label="Days" type="number" value={leaveForm.days} onChange={e => setLeaveForm({ ...leaveForm, days: Number(e.target.value) })} /></div>
          </div>
          <Input label="Reason" type="textarea" value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Why do you need leave?" />
          {leaveForm.leave_type === 'sick' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: colors.textDim, marginBottom: '6px' }}>
                Doctor's Note (Photo)
              </label>
              <div style={{
                border: `2px dashed ${colors.borderLight}`, borderRadius: '8px', padding: '16px', textAlign: 'center',
                background: sickNotePreview ? 'transparent' : colors.bg, cursor: 'pointer', position: 'relative',
              }} onClick={() => document.getElementById('sick-note-upload').click()}>
                <input
                  id="sick-note-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files[0];
                    if (f) {
                      setSickNoteFile(f);
                      setSickNotePreview(URL.createObjectURL(f));
                    }
                  }}
                />
                {sickNotePreview ? (
                  <div>
                    <img src={sickNotePreview} alt="Sick note preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px' }} />
                    <div style={{ fontSize: '11px', color: colors.textDim, marginTop: '8px' }}>{sickNoteFile?.name} — Click to change</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📷</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted }}>Click to upload doctor's note photo</div>
                    <div style={{ fontSize: '11px', color: colors.textDim, marginTop: '4px' }}>JPG, PNG, GIF — Max 10MB</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {leaveForm.leave_type === 'annual' && leaveBalance && (
            <div style={{ fontSize: '12px', color: leaveForm.days > leaveBalance.available_days ? colors.red : colors.green, marginBottom: '8px' }}>
              Available balance: {leaveBalance.available_days.toFixed(1)} days
              {leaveForm.days > leaveBalance.available_days && ' — insufficient balance!'}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Btn variant="secondary" onClick={() => setShowLeaveForm(false)}>Cancel</Btn>
            <Btn onClick={handleApplyLeave} disabled={!leaveForm.start_date || !leaveForm.end_date || leaveForm.days <= 0 || uploadingNote}>{uploadingNote ? 'Uploading...' : 'Submit Request'}</Btn>
          </div>
        </Modal>
      )}

      {/* ─── Clock-Out Feedback Modal ─────────────────────── */}
      {showClockOutFeedback && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: colors.card, borderRadius: '20px', padding: '40px 44px',
            maxWidth: '520px', width: '92%',
            border: `1px solid ${colors.borderLight}`,
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
              <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: colors.text }}>
                End of Day Report
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: colors.textDim }}>
                Before you clock out, tell us about your day.
              </p>
            </div>

            <Input label="What did you accomplish today?" type="textarea" value={clockOutForm.yesterday}
              onChange={e => setClockOutForm({ ...clockOutForm, yesterday: e.target.value })}
              placeholder="Tasks completed, progress made..." />
            <Input label="Any struggles or blockers?" type="textarea" value={clockOutForm.blockers}
              onChange={e => setClockOutForm({ ...clockOutForm, blockers: e.target.value })}
              placeholder="Issues you ran into (optional)..." />
            <Input label="What's your next task?" type="textarea" value={clockOutForm.today}
              onChange={e => setClockOutForm({ ...clockOutForm, today: e.target.value })}
              placeholder="What you'll work on next..." />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <Btn variant="secondary" onClick={handleClockOutSkip} style={{ flex: 1, padding: '14px' }}>
                Skip & Clock Out
              </Btn>
              <Btn variant="danger" onClick={handleClockOutSubmit} style={{ flex: 2, padding: '14px', fontSize: '15px', fontWeight: 700 }}>
                Submit & Clock Out
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── Daily Feedback Modal ─────────────────────────── */}
      {showStandup && (
        <Modal title="Daily Feedback" onClose={() => setShowStandup(false)}>
          <Input label="What did you accomplish today?" type="textarea" value={standupForm.yesterday} onChange={e => setStandupForm({ ...standupForm, yesterday: e.target.value })} placeholder="Completed tasks..." />
          <Input label="What's your plan for tomorrow?" type="textarea" value={standupForm.today} onChange={e => setStandupForm({ ...standupForm, today: e.target.value })} placeholder="Tomorrow's plan..." />
          <Input label="Any blockers?" type="textarea" value={standupForm.blockers} onChange={e => setStandupForm({ ...standupForm, blockers: e.target.value })} placeholder="Issues (optional)" />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Btn variant="secondary" onClick={() => setShowStandup(false)}>Cancel</Btn>
            <Btn onClick={handleStandup}>Submit</Btn>
          </div>
        </Modal>
      )}

      {/* ─── Setup Key Modal ─────────────────────────────── */}
      {showSetupKeyModal && (
        <Modal title="Your Agent Setup Key" onClose={() => setShowSetupKeyModal(false)}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: '13px', color: colors.textDim, marginBottom: '20px' }}>
              Paste this code into the TeamPulse Desktop Agent to pair it with your account.
            </p>
            <div style={{
              fontSize: '36px', fontWeight: 800, letterSpacing: '8px', fontFamily: 'monospace',
              color: colors.accent, padding: '20px', background: colors.bg, borderRadius: '12px',
              border: `1px solid ${colors.borderLight}`, marginBottom: '16px', userSelect: 'all',
            }}>
              {selfSetupCode}
            </div>
            {selfSetupExpiry && (
              <p style={{ fontSize: '12px', color: colors.textDimmer, margin: '0 0 16px' }}>
                Expires in 15 minutes ({new Date(selfSetupExpiry).toLocaleTimeString()})
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <Btn variant="secondary" onClick={() => {
                navigator.clipboard.writeText(selfSetupCode).catch(() => {});
              }}>
                📋 Copy Code
              </Btn>
              <Btn variant="secondary" onClick={() => setShowSetupKeyModal(false)}>Close</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Agent Onboarding Overlay ──────────────────── */}
      {showOnboarding && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} className="fade-in">
          <div style={{
            background: colors.card, borderRadius: '16px', padding: '40px 48px',
            maxWidth: '480px', width: '90%', textAlign: 'center',
            border: `1px solid ${colors.borderLight}`,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{
                  width: s === onboardingStep ? '24px' : '8px', height: '8px', borderRadius: '4px',
                  background: s <= onboardingStep ? colors.gradient : colors.border,
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>

            {/* Step 1: Welcome */}
            {onboardingStep === 1 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖥</div>
                <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: colors.text }}>
                  Install Desktop Agent
                </h2>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: colors.textDim, lineHeight: 1.6 }}>
                  TeamPulse needs a small desktop app to track your activity across all applications — not just this browser tab.
                </p>
                <p style={{ margin: '0 0 28px', fontSize: '13px', color: colors.textDimmer, lineHeight: 1.5 }}>
                  It runs silently in your system tray and only tracks while you're clocked in.
                </p>
                <Btn onClick={startAgentDownload} style={{
                  padding: '14px 40px', fontSize: '15px', fontWeight: 700, borderRadius: '12px', width: '100%',
                }}>
                  Download Agent
                </Btn>
                <button onClick={finishOnboarding} style={{
                  background: 'none', border: 'none', color: colors.textDimmer, fontSize: '12px',
                  cursor: 'pointer', marginTop: '16px', textDecoration: 'underline',
                }}>
                  Skip for now
                </button>
              </div>
            )}

            {/* Step 2: Install */}
            {onboardingStep === 2 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: colors.text }}>
                  Run the Installer
                </h2>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.textDim, lineHeight: 1.6 }}>
                  Run the downloaded <span style={{ color: colors.accent, fontWeight: 600 }}>TeamPulseAgent-Setup.exe</span> — it installs automatically in seconds.
                </p>
                <div style={{
                  background: colors.bg, borderRadius: '12px', padding: '16px', marginBottom: '24px',
                  border: `1px solid ${colors.border}`,
                }}>
                  <div style={{ fontSize: '12px', color: colors.textDim, marginBottom: '8px', fontWeight: 600 }}>Steps:</div>
                  <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: 1.7 }}>
                    1. Open the downloaded <strong>TeamPulseAgent-Setup.exe</strong><br/>
                    2. If Windows SmartScreen appears, click <strong>"More info"</strong> then <strong>"Run anyway"</strong><br/>
                    3. The app installs and launches automatically<br/>
                    4. You'll see a TeamPulse icon in your system tray<br/>
                    5. Click "Next" below to get your connection code
                  </div>
                </div>
                <Btn onClick={generateCode} disabled={setupLoading} style={{
                  padding: '14px 40px', fontSize: '15px', fontWeight: 700, borderRadius: '12px', width: '100%',
                }}>
                  {setupLoading ? 'Generating...' : 'Next — Get Setup Code'}
                </Btn>
                <button onClick={finishOnboarding} style={{
                  background: 'none', border: 'none', color: colors.textDimmer, fontSize: '12px',
                  cursor: 'pointer', marginTop: '16px', textDecoration: 'underline',
                }}>
                  Skip for now
                </button>
              </div>
            )}

            {/* Step 3: Setup Code */}
            {onboardingStep === 3 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
                <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: colors.text }}>
                  Connect Your Agent
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: '14px', color: colors.textDim, lineHeight: 1.6 }}>
                  Enter this code in the desktop agent to link it to your account. No password needed.
                </p>
                <div style={{
                  background: colors.bg, borderRadius: '14px', padding: '24px', marginBottom: '8px',
                  border: `1px solid rgba(59,130,246,0.3)`,
                }}>
                  <div style={{
                    fontSize: '36px', fontWeight: 800, letterSpacing: '8px', fontFamily: 'monospace',
                    background: colors.gradient,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    {setupCode}
                  </div>
                </div>
                <p style={{ margin: '0 0 24px', fontSize: '11px', color: colors.textDimmer }}>
                  Code expires in 15 minutes
                </p>
                <Btn onClick={finishOnboarding} style={{
                  padding: '14px 40px', fontSize: '15px', fontWeight: 700, borderRadius: '12px', width: '100%',
                }}>
                  Done — Start Working
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
