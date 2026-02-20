/**
 * System-wide mouse/keyboard tracking via uiohook-napi.
 * Only counts events — does NOT log key values (privacy).
 */

let uIOhook;
try {
  uIOhook = require('uiohook-napi').uIOhook;
} catch (err) {
  console.error('uiohook-napi failed to load:', err.message);
  uIOhook = null;
}

class InputTracker {
  constructor() {
    this.mouseMoves = 0;
    this.mouseClicks = 0;
    this.keystrokes = 0;
    this.scrollEvents = 0;
    this.lastActivityTime = Date.now();
    this._lastMoveTime = 0;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;

    if (!uIOhook) {
      console.warn('InputTracker: uiohook not available, using fallback (no system-wide tracking)');
      return;
    }

    uIOhook.on('mousemove', () => {
      this.lastActivityTime = Date.now();
      // Throttle: 1 count per second max
      const now = Date.now();
      if (now - this._lastMoveTime >= 1000) {
        this._lastMoveTime = now;
        this.mouseMoves++;
      }
    });

    uIOhook.on('click', () => {
      this.lastActivityTime = Date.now();
      this.mouseClicks++;
    });

    uIOhook.on('keydown', () => {
      this.lastActivityTime = Date.now();
      this.keystrokes++;
    });

    uIOhook.on('wheel', () => {
      this.lastActivityTime = Date.now();
      this.scrollEvents++;
    });

    try {
      uIOhook.start();
      console.log('InputTracker: uiohook started successfully');
    } catch (err) {
      console.error('InputTracker: uiohook.start() failed:', err.message);
    }
  }

  /**
   * Returns the accumulated counts since last flush, then resets.
   */
  flush() {
    const data = {
      mouseMoves: this.mouseMoves,
      mouseClicks: this.mouseClicks,
      keystrokes: this.keystrokes,
      scrollEvents: this.scrollEvents,
      idleSeconds: Math.floor((Date.now() - this.lastActivityTime) / 1000),
    };

    this.mouseMoves = 0;
    this.mouseClicks = 0;
    this.keystrokes = 0;
    this.scrollEvents = 0;

    return data;
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (uIOhook) {
      try { uIOhook.stop(); } catch { /* ignore */ }
    }
  }
}

module.exports = { InputTracker };
