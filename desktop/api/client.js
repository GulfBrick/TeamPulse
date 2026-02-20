const fetch = require('node-fetch');

class ApiClient {
  constructor(store) {
    this.store = store;
    this.baseUrl = store.get('apiUrl') || process.env.TEAMPULSE_API_URL || 'http://localhost:8080/api';
  }

  get token() {
    return this.store.get('token');
  }

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, opts);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async login(email, password) {
    return this.request('POST', '/auth/login', { email, password });
  }

  async authWithCode(code) {
    // Exchange a 6-char setup code for a JWT — no email/password needed
    const res = await fetch(`${this.baseUrl}/agent/auth-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid code');
    return data;
  }

  async getClockStatus() {
    return this.request('GET', '/clock/status');
  }

  async sendHeartbeat(data) {
    return this.request('POST', '/agent/heartbeat', data);
  }

  async sendSegments(segments) {
    return this.request('POST', '/agent/segments', segments);
  }

}

module.exports = { ApiClient };
