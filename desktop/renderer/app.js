const loginView = document.getElementById('login-view');
const statusView = document.getElementById('status-view');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const errorEl = document.getElementById('error');
const userNameEl = document.getElementById('user-name');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const logoutBtn = document.getElementById('logout-btn');

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

// Login
loginBtn.addEventListener('click', async () => {
  errorEl.textContent = '';
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

// Allow Enter key to submit
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await window.teampulse.logout();
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
