const loginView = document.getElementById('login-view');
const statusView = document.getElementById('status-view');
const codeForm = document.getElementById('code-form');
const emailForm = document.getElementById('email-form');
const tabCode = document.getElementById('tab-code');
const tabEmail = document.getElementById('tab-email');
const setupCodeInput = document.getElementById('setup-code');
const codeBtn = document.getElementById('code-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const errorEl = document.getElementById('error');
const userNameEl = document.getElementById('user-name');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const logoutBtn = document.getElementById('logout-btn');
const serverUrlInput = document.getElementById('server-url');

// Load saved server URL
window.teampulse.getApiUrl().then(url => {
  if (url) serverUrlInput.value = url;
});

// Tab switching
window.switchTab = function(tab) {
  errorEl.textContent = '';
  if (tab === 'code') {
    codeForm.classList.remove('hidden');
    emailForm.classList.add('hidden');
    tabCode.classList.add('active');
    tabEmail.classList.remove('active');
    setupCodeInput.focus();
  } else {
    codeForm.classList.add('hidden');
    emailForm.classList.remove('hidden');
    tabCode.classList.remove('active');
    tabEmail.classList.add('active');
    emailInput.focus();
  }
};

function showLogin() {
  loginView.style.display = 'block';
  statusView.classList.remove('active');
}

function showStatus(user, isClockedIn) {
  loginView.style.display = 'none';
  statusView.classList.add('active');
  userNameEl.textContent = user?.name || 'Employee';
  statusDot.className = `status-dot ${isClockedIn ? 'tracking' : 'idle'}`;
  statusText.textContent = isClockedIn ? 'Tracking Active' : 'Waiting for clock-in...';
}

// Check initial status
window.teampulse.getStatus().then(({ loggedIn, user, isClockedIn }) => {
  if (loggedIn) {
    showStatus(user, isClockedIn);
  } else {
    showLogin();
  }
});

// Helper: ensure server URL is set before any auth
async function ensureServerUrl() {
  const url = serverUrlInput.value.trim();
  if (!url) {
    errorEl.textContent = 'Please enter your server URL first.';
    return false;
  }
  await window.teampulse.setApiUrl(url);
  return true;
}

// Setup code auth
codeBtn.addEventListener('click', async () => {
  errorEl.textContent = '';

  if (!(await ensureServerUrl())) return;

  const code = setupCodeInput.value.trim().toUpperCase();

  if (!code || code.length !== 6) {
    errorEl.textContent = 'Please enter a 6-character setup code.';
    return;
  }

  codeBtn.disabled = true;
  codeBtn.textContent = 'Connecting...';

  try {
    const result = await window.teampulse.authWithCode(code);
    showStatus(result.user, false);
  } catch (err) {
    errorEl.textContent = err.message || 'Invalid or expired code';
  }

  codeBtn.disabled = false;
  codeBtn.textContent = 'Connect';
});

setupCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') codeBtn.click();
});

// Auto-uppercase as you type
setupCodeInput.addEventListener('input', () => {
  setupCodeInput.value = setupCodeInput.value.toUpperCase();
});

// Email/password login
loginBtn.addEventListener('click', async () => {
  errorEl.textContent = '';

  if (!(await ensureServerUrl())) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password.';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const result = await window.teampulse.login(email, password);
    showStatus(result.user, false);
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed';
  }

  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign In';
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await window.teampulse.logout();
  setupCodeInput.value = '';
  emailInput.value = '';
  passwordInput.value = '';
  showLogin();
});

// Listen for clock status updates from main process
window.teampulse.onClockStatus((status) => {
  window.teampulse.getStatus().then(({ user }) => {
    showStatus(user, status.clocked_in);
  });
});
