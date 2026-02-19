const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('tp_token') || null;
    this.user = JSON.parse(localStorage.getItem('tp_user') || 'null');
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.listeners.forEach(fn => fn({ token: this.token, user: this.user }));
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('tp_token', token);
    localStorage.setItem('tp_user', JSON.stringify(user));
    this.notify();
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('tp_token');
    localStorage.removeItem('tp_user');
    this.notify();
  }

  get isLoggedIn() {
    return !!this.token;
  }

  get isAdmin() {
    return this.user?.role === 'admin';
  }

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);

    if (res.status === 401) {
      this.logout();
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // Auth
  login(email, password) { return this.request('POST', '/auth/login', { email, password }); }
  getMe() { return this.request('GET', '/auth/me'); }

  // Employees (admin)
  listEmployees() { return this.request('GET', '/employees'); }
  createEmployee(data) { return this.request('POST', '/employees', data); }
  updateEmployee(id, data) { return this.request('PUT', `/employees/${id}`, data); }
  deleteEmployee(id) { return this.request('DELETE', `/employees/${id}`); }

  // Clock
  clockIn() { return this.request('POST', '/clock/in'); }
  clockOut() { return this.request('POST', '/clock/out'); }
  getClockStatus() { return this.request('GET', '/clock/status'); }
  getTimeEntries(date) { return this.request('GET', `/clock/entries${date ? `?date=${date}` : ''}`); }

  // Activity
  sendPing(isActive, idleSeconds = 0) { return this.request('POST', '/activity/ping', { is_active: isActive, idle_seconds: idleSeconds }); }
  getActivityStats(date) { return this.request('GET', `/activity/stats${date ? `?date=${date}` : ''}`); }

  // Tasks
  listTasks(status) { return this.request('GET', `/tasks${status ? `?status=${status}` : ''}`); }
  createTask(data) { return this.request('POST', '/tasks', data); }
  updateTask(id, data) { return this.request('PUT', `/tasks/${id}`, data); }
  deleteTask(id) { return this.request('DELETE', `/tasks/${id}`); }
  startTaskTimer(taskId) { return this.request('POST', `/tasks/${taskId}/timer/start`); }
  stopTaskTimer() { return this.request('POST', '/tasks/timer/stop'); }
  getActiveTimer() { return this.request('GET', '/tasks/timer/active'); }

  // KPIs
  listKPIs() { return this.request('GET', '/kpis'); }
  createKPI(data) { return this.request('POST', '/kpis', data); }
  updateKPI(id, data) { return this.request('PUT', `/kpis/${id}`, data); }
  deleteKPI(id) { return this.request('DELETE', `/kpis/${id}`); }

  // Standups
  listStandups(date) { return this.request('GET', `/standups${date ? `?date=${date}` : ''}`); }
  createStandup(data) { return this.request('POST', '/standups', data); }
  deleteStandup(id) { return this.request('DELETE', `/standups/${id}`); }

  // Dashboard (admin)
  getDashboard() { return this.request('GET', '/dashboard'); }
}

export const api = new ApiClient();
