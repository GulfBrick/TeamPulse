/**
 * Tracks the currently active window (app name + title).
 * Uses the `active-win` package.
 */

let activeWin;
try {
  activeWin = require('active-win');
} catch {
  activeWin = null;
}

class WindowTracker {
  constructor() {
    this._current = { app: '', title: '' };
    this._interval = null;
  }

  start() {
    if (this._interval) return;

    const poll = async () => {
      try {
        if (!activeWin) return;
        const win = await activeWin();
        if (win) {
          this._current = {
            app: win.owner?.name || '',
            title: win.title || '',
          };
        }
      } catch {
        // ignore polling errors
      }
    };

    poll(); // immediate first read
    this._interval = setInterval(poll, 5000); // poll every 5 seconds
  }

  getCurrent() {
    return { ...this._current };
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}

module.exports = { WindowTracker };
