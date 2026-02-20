const { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { ApiClient } = require('./api/client');
const { InputTracker } = require('./tracking/inputTracker');
const { WindowTracker } = require('./tracking/windowTracker');
const { ScreenshotCapture } = require('./tracking/screenshotCapture');
const { SegmentEngine } = require('./tracking/segmentEngine');
const { LocalQueue } = require('./tracking/localQueue');

const store = new Store();
const apiClient = new ApiClient(store);

let mainWindow = null;
let tray = null;
let inputTracker = null;
let windowTracker = null;
let screenshotCapture = null;
let segmentEngine = null;
let localQueue = null;
let heartbeatInterval = null;
let segmentInterval = null;
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
    // Don't show if launched hidden at boot and already logged in
    if (!store.get('token') && !launchedHidden) {
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

  const autoStartEnabled = app.getLoginItemSettings().openAtLogin;

  if (loggedIn) {
    template.push(
      { label: `Status: ${isClockedIn ? 'Tracking' : 'Idle'}`, enabled: false },
      { type: 'separator' },
      { label: 'Show Window', click: () => mainWindow?.show() },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: autoStartEnabled,
        click: (item) => {
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            path: app.getPath('exe'),
            args: item.checked ? ['--hidden'] : [],
          });
        },
      },
      { type: 'separator' },
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
  segmentEngine = new SegmentEngine();
  if (!localQueue) localQueue = new LocalQueue();

  inputTracker.start();
  windowTracker.start();

  // Start segment engine with initial window
  const initialWindow = windowTracker.getCurrent();
  segmentEngine.start(initialWindow.app, initialWindow.title);

  // Legacy heartbeat + segment feed every 5 seconds
  const sendHeartbeat = async () => {
    try {
      const inputData = inputTracker.flush();
      const windowData = windowTracker.getCurrent();

      // Feed input events to segment engine
      segmentEngine.recordInput(inputData);
      segmentEngine.recordAppChange(windowData.app, windowData.title);

      // Legacy heartbeat (keep for monitoring tab backward compat)
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
  };

  // Segment flush + send cycle every 5 seconds
  const processSegments = async () => {
    try {
      // Flush completed segments from engine into local queue
      const completed = segmentEngine.flush();
      if (completed.length > 0) {
        localQueue.enqueue(completed);
      }

      // Dequeue and send batch
      const batch = localQueue.dequeue(50);
      if (batch.length > 0) {
        const segments = batch.map(b => b.segment);
        const ids = batch.map(b => b.id);
        await apiClient.sendSegments(segments);
        localQueue.markSent(ids);
      }
    } catch (err) {
      // Network failure — segments stay in local queue, retried next tick
      console.error('Segment send failed (queued for retry):', err.message);
    }
  };

  sendHeartbeat(); // immediate first heartbeat
  heartbeatInterval = setInterval(sendHeartbeat, 5_000);
  segmentInterval = setInterval(processSegments, 5_000);

  // Take screenshot every 2 minutes
  screenshotCapture.startInterval(2 * 60_000, async (buffer) => {
    try {
      await apiClient.uploadScreenshot(buffer);
    } catch (err) {
      console.error('Screenshot upload failed:', err.message);
    }
  });

  showNotification('Tracking Started', 'TeamPulse is now monitoring your activity.');
}

function stopTracking() {
  // Flush remaining segments before stopping
  if (segmentEngine && localQueue) {
    const remaining = segmentEngine.stop();
    if (remaining.length > 0) {
      localQueue.enqueue(remaining);
    }
  }

  if (inputTracker) { inputTracker.stop(); inputTracker = null; }
  if (windowTracker) { windowTracker.stop(); windowTracker = null; }
  if (screenshotCapture) { screenshotCapture.stop(); screenshotCapture = null; }
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  if (segmentInterval) { clearInterval(segmentInterval); segmentInterval = null; }
  segmentEngine = null;
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

ipcMain.handle('set-api-url', async (_event, { url }) => {
  // Normalize: strip trailing slashes and /api suffix, then re-add /api
  let clean = url.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  const apiUrl = clean + '/api';
  store.set('apiUrl', apiUrl);
  store.set('serverUrl', clean);
  apiClient.baseUrl = apiUrl;
  return { ok: true };
});

ipcMain.handle('get-api-url', async () => {
  return store.get('serverUrl') || '';
});

ipcMain.handle('auth-code', async (_event, { code }) => {
  const result = await apiClient.authWithCode(code);
  store.set('token', result.token);
  store.set('user', result.user);
  updateTrayMenu();
  startClockCheck();
  if (mainWindow) mainWindow.hide();
  return result;
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

// ─── Auto-Start on Boot ──────────────────────────────────────

function enableAutoStart() {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
    args: ['--hidden'],  // launch hidden (straight to tray)
  });
}

// ─── App Lifecycle ───────────────────────────────────────────

// Check if launched with --hidden flag (auto-start on boot)
const launchedHidden = process.argv.includes('--hidden');

app.on('ready', () => {
  // Register auto-start on first run after login
  enableAutoStart();

  createWindow();
  createTray();

  // If launched at boot with --hidden, don't show the window at all
  if (launchedHidden && store.get('token')) {
    // Already logged in, just start silently
  }

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
  if (localQueue) { localQueue.close(); localQueue = null; }
});
