const { autoUpdater } = require('electron-updater');
const { Notification, app } = require('electron');
const log = require('electron-log');

let updateCheckInterval = null;
let updateDownloaded = false;

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const STARTUP_DELAY_MS = 10 * 1000; // 10 seconds

function initAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = log;

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    log.info('No updates available.');
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    updateDownloaded = true;

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'TeamPulse Update Ready',
        body: `Version ${info.version} will install on next restart.`,
      });
      notification.show();
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err.message);
  });

  // Initial check after startup delay
  setTimeout(() => {
    checkForUpdates();
  }, STARTUP_DELAY_MS);

  // Periodic checks
  updateCheckInterval = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}

function checkForUpdates() {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update check failed:', err.message);
    });
  }
}

function isUpdateDownloaded() {
  return updateDownloaded;
}

function quitAndInstall() {
  autoUpdater.quitAndInstall(false, true);
}

function stopUpdateChecks() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
  isUpdateDownloaded,
  quitAndInstall,
  stopUpdateChecks,
};
