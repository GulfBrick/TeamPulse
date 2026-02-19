/**
 * Periodic screenshot capture using screenshot-desktop.
 * Returns PNG buffers to be uploaded to the backend.
 */

let screenshot;
try {
  screenshot = require('screenshot-desktop');
} catch {
  screenshot = null;
}

class ScreenshotCapture {
  constructor() {
    this._interval = null;
  }

  /**
   * Start taking screenshots at the given interval (ms).
   * @param {number} intervalMs - milliseconds between captures
   * @param {function} onCapture - callback receiving the PNG buffer
   */
  startInterval(intervalMs, onCapture) {
    if (this._interval || !screenshot) return;

    const capture = async () => {
      try {
        const buffer = await screenshot({ format: 'png' });
        if (onCapture) await onCapture(buffer);
      } catch (err) {
        console.error('Screenshot capture failed:', err.message);
      }
    };

    // Don't capture immediately — wait for the first interval
    this._interval = setInterval(capture, intervalMs);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}

module.exports = { ScreenshotCapture };
