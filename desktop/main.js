const { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { ApiClient } = require('./api/client');
const { InputTracker } = require('./tracking/inputTracker');
const { WindowTracker } = require('./tracking/windowTracker');
const { ScreenshotCapture } = require('./tracking/screenshotCapture');

const store = new Store();
const apiClient = new ApiClient(store);

let mainWindow = null;
let tray = null;
let inputTracker = null;
let windowTracker = null;
let screenshotCapture = null;
let heartbeatInterval = null;
let clockCheckInterval = null;
let isClockedIn = false;

// ─── Window ──────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    frame: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (!store.get('token')) {
      mainWindow.show();
    }
  });
}

// ─── System Tray ─────────────────────────────────────────────

function createTray() {
  // Use a simple 16x16 icon; in production replace with proper .ico
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('TeamPulse Agent');
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) mainWindow.show();
  });
}

function updateTrayMenu() {
  const loggedIn = !!store.get('token');
  const template = [];

  if (loggedIn) {
    template.push(
      { label: `Status: ${isClockedIn ? 'Tracking' : 'Idle'}`, enabled: false },
      { type: 'separator' },
      { label: 'Show Window', click: () => mainWindow?.show() },
      { label: 'Logout', click: () => logout() },
    );
  } else {
    template.push(
      { label: 'Login', click: () => mainWindow?.show() },
    );
  }

  template.push(
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ─── Auth ────────────────────────────────────────────────────

async function login(email, password) {
  const result = await apiClient.login(email, password);
  store.set('token', result.token);
  store.set('user', result.user);
  updateTrayMenu();
  startClockCheck();
  return result;
}

function logout() {
  stopTracking();
  store.delete('token');
  store.delete('user');
  isClockedIn = false;
  updateTrayMenu();
  if (clockCheckInterval) {
    clearInterval(clockCheckInterval);
    clockCheckInterval = null;
  }
  mainWindow?.show();
}

// ─── Tracking ────────────────────────────────────────────────

function startTracking() {
  if (inputTracker) return; // already tracking

  inputTracker = new InputTracker();
  windowTracker = new WindowTracker();
  screenshotCapture = new ScreenshotCapture();

  inputTracker.start();
  windowTracker.start();

  // Send heartbeat every 60 seconds
  heartbeatInterval = setInterval(async () => {
    try {
      const inputData = inputTracker.flush();
      const windowData = windowTracker.getCurrent();

      await apiClient.sendHeartbeat({
        mouse_moves: inputData.mouseMoves,
        mouse_clicks: inputData.mouseClicks,
        keystrokes: inputData.keystrokes,
        scroll_events: inputData.scrollEvents,
        active_app: windowData.app,
        active_window_title: windowData.title,
        idle_seconds: inputData.idleSeconds,
      });
    } catch (err) {
      console.error('Heartbeat failed:', err.message);
    }
  }, 60_000);

  // Take screenshot every 5 minutes
  screenshotCapture.startInterval(5 * 60_000, async (buffer) => {
    try {
      await apiClient.uploadScreenshot(buffer);
    } catch (err) {
      console.error('Screenshot upload failed:', err.message);
    }
  });

  showNotification('Tracking Started', 'TeamPulse is now monitoring your activity.');
}

function stopTracking() {
  if (inputTracker) { inputTracker.stop(); inputTracker = null; }
  if (windowTracker) { windowTracker.stop(); windowTracker = null; }
  if (screenshotCapture) { screenshotCapture.stop(); screenshotCapture = null; }
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
}

// ─── Clock Status Check ─────────────────────────────────────

function startClockCheck() {
  // Check clock status every 30 seconds
  const check = async () => {
    try {
      const status = await apiClient.getClockStatus();
      const wasClockedIn = isClockedIn;
      isClockedIn = status.clocked_in;

      if (isClockedIn && !wasClockedIn) {
        startTracking();
      } else if (!isClockedIn && wasClockedIn) {
        stopTracking();
        showNotification('Tracking Paused', 'You are no longer clocked in.');
      }

      updateTrayMenu();
      mainWindow?.webContents.send('clock-status', status);
    } catch (err) {
      console.error('Clock check failed:', err.message);
    }
  };

  check(); // immediate first check
  clockCheckInterval = setInterval(check, 30_000);
}

// ─── Notifications ───────────────────────────────────────────

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

// ─── IPC Handlers ────────────────────────────────────────────

ipcMain.handle('login', async (_event, { email, password }) => {
  return login(email, password);
});

ipcMain.handle('logout', async () => {
  logout();
});

ipcMain.handle('get-status', () => {
  return {
    loggedIn: !!store.get('token'),
    user: store.get('user'),
    isClockedIn,
  };
});

// ─── App Lifecycle ───────────────────────────────────────────

app.on('ready', () => {
  createWindow();
  createTray();

  if (store.get('token')) {
    startClockCheck();
  }
});

app.on('window-all-closed', (e) => {
  // Don't quit — keep running in tray
  e?.preventDefault?.();
});

app.on('before-quit', () => {
  stopTracking();
});
