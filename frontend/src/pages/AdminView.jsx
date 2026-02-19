import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../hooks/api';
import { Card, Badge, Btn, Input, Modal, EmptyState, StatCard, PageHeader, TabBar, formatTime, formatDate, formatDateTime, todayStr } from '../components/UI';

export default function AdminView() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [kpis, setKPIs] = useState([]);
  const [standups, setStandups] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activityStats, setActivityStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddKPI, setShowAddKPI] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', email: '', password: '', title: '', role: 'employee' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignee_id: null, priority: 'medium', due_date: '' });
  const [kpiForm, setKpiForm] = useState({ user_id: null, metric: '', target: 0, current: 0, unit: '' });

  // Filters
  const [taskFilter, setTaskFilter] = useState('all');
  const [standupDate, setStandupDate] = useState(todayStr());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, e, t, k, s, te, as_] = await Promise.all([
        api.getDashboard().catch(() => null),
        api.listEmployees().catch(() => []),
        api.listTasks().catch(() => []),
        api.listKPIs().catch(() => []),
        api.listStandups(standupDate).catch(() => []),
        api.getTimeEntries().catch(() => []),
        api.getActivityStats().catch(() => []),
      ]);
      setDashboard(d);
      setEmployees(e);
      setTasks(t);
      setKPIs(k);
      setStandups(s);
      setTimeEntries(te);
      setActivityStats(as_);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [standupDate]);

  useEffect(() => { refresh(); }, [refresh]);

  // ─── Handlers ───────────────────────────────────────────────

  const addEmployee = async () => {
    try {
      await api.createEmployee(empForm);
      setEmpForm({ name: '', email: '', password: '', title: '', role: 'employee' });
      setShowAddEmployee(false);
      refresh();
    } catch (err) {
      alert(err.message || 'Failed to add employee');
    }
  };

  const addTask = async () => {
    const payload = { ...taskForm };
    if (payload.assignee_id) payload.assignee_id = Number(payload.assignee_id);
    else delete payload.assignee_id;
    await api.createTask(payload);
    setTaskForm({ title: '', description: '', assignee_id: null, priority: 'medium', due_date: '' });
    setShowAddTask(false);
    refresh();
  };

  const addKPI = async () => {
    await api.createKPI({ ...kpiForm, user_id: Number(kpiForm.user_id), target: Number(kpiForm.target), current: Number(kpiForm.current) });
    setKpiForm({ user_id: null, metric: '', target: 0, current: 0, unit: '' });
    setShowAddKPI(false);
    refresh();
  };

  const cycleTask = async (task) => {
    const order = ['pending', 'in_progress', 'complete'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await api.updateTask(task.id, { status: next });
    refresh();
  };

  const updateKPICurrent = async (kpiId, value) => {
    await api.updateKPI(kpiId, { current: Number(value) });
    refresh();
  };

  const tabs = ['dashboard', 'team', 'time', 'tasks', 'kpis', 'standups'];
  const tabIcons = { dashboard: '◈', team: '👥', time: '⏱', tasks: '☑', kpis: '◉', standups: '◇' };
  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter);
  const priorityColor = { high: '#f87171', medium: '#fbbf24', low: '#34d399' };

  if (loading && !dashboard) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading dashboard...</div>;
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            background: tab === t ? '#3b82f6' : 'transparent', color: tab === t ? '#fff' : '#64748b',
            border: tab === t ? 'none' : '1px solid #2a2a3a', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {tabIcons[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ═══ DASHBOARD ══════════════════════════════════════ */}
      {tab === 'dashboard' && dashboard && (
        <div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
            <StatCard label="Team Size" value={dashboard.total_employees} />
            <StatCard label="Clocked In" value={dashboard.clocked_in} accent="#34d399" sub={`of ${dashboard.total_employees}`} />
            <StatCard label="Hours Today" value={`${dashboard.total_hours_today.toFixed(1)}h`} accent="#fbbf24" />
            <StatCard label="Tasks Done Today" value={dashboard.tasks_done_today} accent="#a78bfa" sub={`${dashboard.pending_tasks} pending`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Team Status */}
            <Card>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>Team Status</h3>
              {(dashboard.team_status || []).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1e1e2e' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      {m.title}{m.title && ' · '}{m.hours_today.toFixed(1)}h today
                      {m.active_task && <span style={{ color: '#60a5fa' }}> · Working on: {m.active_task}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge status={m.is_clocked_in ? 'clocked-in' : 'clocked-out'} />
                  </div>
                </div>
              ))}
              {(!dashboard.team_status || dashboard.team_status.length === 0) && (
                <p style={{ color: '#475569', fontSize: '13px' }}>No employees yet.</p>
              )}
            </Card>

            {/* Activity Overview */}
            <Card>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>Activity Tracking (Today)</h3>
              {(activityStats || []).length === 0 ? (
                <p style={{ color: '#475569', fontSize: '13px' }}>No activity data yet. Pings are recorded when employees are clocked in.</p>
              ) : (
                activityStats.map((s, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #1e1e2e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 500 }}>{s.user_name}</span>
                      <span style={{
                        fontSize: '13px', fontWeight: 600,
                        color: s.active_percent >= 80 ? '#34d399' : s.active_percent >= 50 ? '#fbbf24' : '#f87171',
                      }}>
                        {s.active_percent.toFixed(0)}% active
                      </span>
                    </div>
                    <div style={{ background: '#0d0d17', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${s.active_percent}%`, height: '100%', borderRadius: '4px',
                        background: s.active_percent >= 80 ? '#34d399' : s.active_percent >= 50 ? '#fbbf24' : '#f87171',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                      {s.active_pings} active / {s.total_pings} total pings
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TEAM MANAGEMENT ════════════════════════════════ */}
      {tab === 'team' && (
        <div>
          <PageHeader title="Team Management" right={<Btn onClick={() => setShowAddEmployee(true)}>+ Add Employee</Btn>} />
          {employees.length === 0 ? (
            <EmptyState icon="👥" message="No employees added yet." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {employees.map(emp => (
                <Card key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>{emp.name}</span>
                      <Badge status={emp.role === 'admin' ? 'exceeded' : 'pending'} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{emp.email} · {emp.title || 'No title'}</div>
                  </div>
                  <Btn variant="secondary" onClick={() => { if (confirm('Deactivate this employee?')) { api.deleteEmployee(emp.id).then(refresh); } }} style={{ padding: '8px 12px', fontSize: '12px' }}>
                    Deactivate
                  </Btn>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TIME ENTRIES ═══════════════════════════════════ */}
      {tab === 'time' && (
        <div>
          <PageHeader title="Time Entries" />
          {timeEntries.length === 0 ? (
            <EmptyState icon="⏱" message="No time entries yet." />
          ) : (
            <Card style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                    {['Employee', 'Date', 'Clock In', 'Clock Out', 'Duration'].map(h => (
                      <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #1e1e2e' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#f1f5f9' }}>{entry.user?.name || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8' }}>{formatDate(entry.clock_in)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8' }}>{new Date(entry.clock_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8' }}>
                        {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : <Badge status="clocked-in" />}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#60a5fa', fontWeight: 500 }}>
                        {entry.duration_seconds ? formatTime(entry.duration_seconds) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ═══ TASKS ══════════════════════════════════════════ */}
      {tab === 'tasks' && (
        <div>
          <PageHeader title="Tasks" right={<Btn onClick={() => setShowAddTask(true)}>+ Add Task</Btn>} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['all', 'pending', 'in_progress', 'complete'].map(f => (
              <button key={f} onClick={() => setTaskFilter(f)} style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                background: taskFilter === f ? '#3b82f6' : 'transparent', color: taskFilter === f ? '#fff' : '#64748b',
                border: taskFilter === f ? 'none' : '1px solid #2a2a3a',
              }}>
                {f === 'all' ? 'All' : f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
          {filteredTasks.length === 0 ? (
            <EmptyState icon="📋" message="No tasks found." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTasks.map(task => {
                const totalTime = (task.task_times || []).reduce((sum, tt) => sum + (tt.duration_seconds || 0), 0);
                const isOverdue = task.due_date && task.status !== 'complete' && task.due_date < todayStr();
                return (
                  <Card key={task.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: isOverdue ? '1px solid #5c1a1a' : undefined,
                  }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => cycleTask(task)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColor[task.priority] }} />
                        <span style={{
                          fontSize: '14px', fontWeight: 500, color: '#f1f5f9',
                          textDecoration: task.status === 'complete' ? 'line-through' : 'none',
                          opacity: task.status === 'complete' ? 0.6 : 1,
                        }}>{task.title}</span>
                        <Badge status={isOverdue ? 'overdue' : task.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginLeft: '18px' }}>
                        {task.assignee?.name || 'Unassigned'}
                        {task.due_date && ` · Due ${formatDate(task.due_date)}`}
                        {totalTime > 0 && ` · ${formatTime(totalTime)} logged`}
                      </div>
                    </div>
                    <Btn variant="secondary" onClick={() => { api.deleteTask(task.id).then(refresh); }} style={{ padding: '6px 10px', fontSize: '12px' }}>✕</Btn>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ KPIs ═══════════════════════════════════════════ */}
      {tab === 'kpis' && (
        <div>
          <PageHeader title="Performance Metrics" right={<Btn onClick={() => setShowAddKPI(true)}>+ Add KPI</Btn>} />
          {kpis.length === 0 ? (
            <EmptyState icon="📊" message="No KPIs defined yet." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {kpis.map(kpi => {
                const pct = kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 120) : 0;
                const status = pct >= 100 ? 'exceeded' : pct >= 70 ? 'on-track' : 'behind';
                const barColor = status === 'exceeded' ? '#a78bfa' : status === 'on-track' ? '#34d399' : '#f87171';
                return (
                  <Card key={kpi.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>{kpi.metric}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{kpi.user?.name || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Badge status={status} />
                        <button onClick={() => { api.deleteKPI(kpi.id).then(refresh); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 700, color: barColor }}>{kpi.current}</span>
                      <span style={{ fontSize: '14px', color: '#64748b' }}>/ {kpi.target} {kpi.unit}</span>
                    </div>
                    <div style={{ background: '#0d0d17', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="number" placeholder="Update..." style={{
                        flex: 1, padding: '6px 10px', background: '#0d0d17', border: '1px solid #2a2a3a',
                        borderRadius: '6px', color: '#f1f5f9', fontSize: '12px', outline: 'none',
                      }} onKeyDown={e => { if (e.key === 'Enter' && e.target.value) { updateKPICurrent(kpi.id, e.target.value); e.target.value = ''; } }} />
                      <span style={{ fontSize: '10px', color: '#475569', alignSelf: 'center' }}>↵</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ STANDUPS ═══════════════════════════════════════ */}
      {tab === 'standups' && (
        <div>
          <PageHeader title="Daily Standups" right={
            <input type="date" value={standupDate} onChange={e => setStandupDate(e.target.value)} style={{
              padding: '8px 12px', background: '#0d0d17', border: '1px solid #2a2a3a',
              borderRadius: '6px', color: '#94a3b8', fontSize: '13px', outline: 'none',
            }} />
          } />
          {standups.length === 0 ? (
            <EmptyState icon="🗓️" message={`No standups for ${formatDate(standupDate)}.`} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {standups.map(s => (
                <Card key={s.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>{s.user?.name || 'Unknown'}</span>
                      <span style={{ fontSize: '12px', color: '#475569', marginLeft: '10px' }}>{formatDateTime(s.created_at)}</span>
                    </div>
                    <button onClick={() => { api.deleteStandup(s.id).then(refresh); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>✅ Yesterday</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{s.yesterday || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>🎯 Today</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{s.today}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>🚧 Blockers</div>
                      <div style={{ fontSize: '13px', color: s.blockers ? '#f87171' : '#94a3b8', lineHeight: 1.5 }}>{s.blockers || 'None'}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ MODALS ═════════════════════════════════════════ */}

      {showAddEmployee && (
        <Modal title="Add Employee" onClose={() => setShowAddEmployee(false)}>
          <Input label="Full Name" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} placeholder="John Smith" />
          <Input label="Email" type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} placeholder="john@company.com" />
          <Input label="Password" type="password" value={empForm.password} onChange={e => setEmpForm({ ...empForm, password: e.target.value })} placeholder="Initial password" />
          <Input label="Job Title" value={empForm.title} onChange={e => setEmpForm({ ...empForm, title: e.target.value })} placeholder="Developer" />
          <Input label="Role" type="select" value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </Input>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowAddEmployee(false)}>Cancel</Btn>
            <Btn onClick={addEmployee}>Add Employee</Btn>
          </div>
        </Modal>
      )}

      {showAddTask && (
        <Modal title="Add Task" onClose={() => setShowAddTask(false)}>
          <Input label="Title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Complete API integration" />
          <Input label="Description" type="textarea" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
          <Input label="Assignee" type="select" value={taskForm.assignee_id || ''} onChange={e => setTaskForm({ ...taskForm, assignee_id: e.target.value || null })}>
            <option value="">Unassigned</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Input>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <Input label="Priority" type="select" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Input>
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Due Date" type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowAddTask(false)}>Cancel</Btn>
            <Btn onClick={addTask}>Add Task</Btn>
          </div>
        </Modal>
      )}

      {showAddKPI && (
        <Modal title="Add KPI" onClose={() => setShowAddKPI(false)}>
          <Input label="Employee" type="select" value={kpiForm.user_id || ''} onChange={e => setKpiForm({ ...kpiForm, user_id: e.target.value })}>
            <option value="">Select...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Input>
          <Input label="Metric" value={kpiForm.metric} onChange={e => setKpiForm({ ...kpiForm, metric: e.target.value })} placeholder="Deals Closed" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><Input label="Target" type="number" value={kpiForm.target} onChange={e => setKpiForm({ ...kpiForm, target: e.target.value })} /></div>
            <div style={{ flex: 1 }}><Input label="Current" type="number" value={kpiForm.current} onChange={e => setKpiForm({ ...kpiForm, current: e.target.value })} /></div>
            <div style={{ flex: 1 }}><Input label="Unit" value={kpiForm.unit} onChange={e => setKpiForm({ ...kpiForm, unit: e.target.value })} placeholder="deals" /></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowAddKPI(false)}>Cancel</Btn>
            <Btn onClick={addKPI}>Add KPI</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
