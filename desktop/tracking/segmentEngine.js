/**
 * SegmentEngine — State machine that converts raw input events into time segments.
 *
 * Opens a segment when: app changes, idle starts, idle ends
 * Closes previous segment (sets end_time, calculates duration)
 * Accumulates input counts within each segment
 * Idle threshold: 120 seconds of no input → close active segment, open idle segment
 */

const IDLE_THRESHOLD_MS = 120_000; // 2 minutes

class SegmentEngine {
  constructor() {
    this._currentSegment = null;
    this._completedSegments = [];
    this._isIdle = false;
    this._lastInputTime = Date.now();
    this._currentApp = '';
    this._currentTitle = '';
  }

  /**
   * Called when input events are detected (from InputTracker).
   * Resets idle timer and accumulates counts on current segment.
   */
  recordInput(events) {
    const now = Date.now();
    this._lastInputTime = now;

    // If we were idle, transition back to active
    if (this._isIdle) {
      this._closeCurrentSegment(now);
      this._isIdle = false;
      this._openSegment('active', this._currentApp, this._currentTitle, now);
    }

    // Accumulate input counts on current segment
    if (this._currentSegment) {
      this._currentSegment.mouseMoves += (events.mouseMoves || 0);
      this._currentSegment.mouseClicks += (events.mouseClicks || 0);
      this._currentSegment.keystrokes += (events.keystrokes || 0);
      this._currentSegment.scrollEvents += (events.scrollEvents || 0);
    }
  }

  /**
   * Called when the active window changes.
   */
  recordAppChange(appName, windowTitle) {
    const now = Date.now();

    if (appName === this._currentApp && windowTitle === this._currentTitle) {
      return; // No change
    }

    this._currentApp = appName;
    this._currentTitle = windowTitle;

    // Don't create segments during idle
    if (this._isIdle) return;

    // Close current segment and open new one with new app
    this._closeCurrentSegment(now);
    this._openSegment('active', appName, windowTitle, now);
  }

  /**
   * Called periodically (every 5s) to check idle state.
   * Returns nothing — idle detection happens here.
   */
  tick() {
    const now = Date.now();
    const idleDuration = now - this._lastInputTime;

    if (!this._isIdle && idleDuration >= IDLE_THRESHOLD_MS) {
      // Transition to idle
      // Close the active segment at the point we went idle
      const idleStartTime = this._lastInputTime;
      this._closeCurrentSegment(idleStartTime);
      this._isIdle = true;
      this._openSegment('idle', this._currentApp, this._currentTitle, idleStartTime);
    }

    // If idle, keep extending the idle segment's end time
    if (this._isIdle && this._currentSegment) {
      this._currentSegment.endTime = now;
    }
  }

  /**
   * Flush all completed segments and return them.
   * Splits the current open segment at the flush boundary so data is sent regularly.
   */
  flush() {
    // Tick to check idle state before flushing
    this.tick();

    // Split the current open segment: close it now and reopen a continuation
    // This ensures data is sent every flush cycle instead of waiting for app change/idle
    if (this._currentSegment) {
      const now = Date.now();
      const duration = now - this._currentSegment.startTime;

      if (duration >= 1000) {
        // Close current segment at this moment
        this._currentSegment.endTime = now;
        this._completedSegments.push({ ...this._currentSegment });

        // Reopen a continuation segment with the same app/type
        this._openSegment(
          this._currentSegment.segmentType,
          this._currentSegment.appName,
          this._currentSegment.windowTitle,
          now
        );
      }
    }

    const segments = this._completedSegments.map(seg => ({
      start_time: new Date(seg.startTime).toISOString(),
      end_time: new Date(seg.endTime).toISOString(),
      segment_type: seg.segmentType,
      app_name: seg.appName,
      window_title: seg.windowTitle,
      mouse_moves: seg.mouseMoves,
      mouse_clicks: seg.mouseClicks,
      keystrokes: seg.keystrokes,
      scroll_events: seg.scrollEvents,
    }));

    this._completedSegments = [];
    return segments;
  }

  /**
   * Force-close the current segment (e.g., when tracking stops).
   */
  stop() {
    this._closeCurrentSegment(Date.now());
    const segments = this.flush();
    this._currentSegment = null;
    this._isIdle = false;
    return segments;
  }

  /**
   * Start tracking with initial app info.
   */
  start(appName, windowTitle) {
    this._currentApp = appName || '';
    this._currentTitle = windowTitle || '';
    this._lastInputTime = Date.now();
    this._isIdle = false;
    this._openSegment('active', this._currentApp, this._currentTitle, Date.now());
  }

  // ─── Internal ────────────────────────────────────────────

  _openSegment(type_, appName, windowTitle, timestamp) {
    this._currentSegment = {
      startTime: timestamp,
      endTime: timestamp,
      segmentType: type_,
      appName: appName || '',
      windowTitle: windowTitle || '',
      mouseMoves: 0,
      mouseClicks: 0,
      keystrokes: 0,
      scrollEvents: 0,
    };
  }

  _closeCurrentSegment(timestamp) {
    if (!this._currentSegment) return;

    this._currentSegment.endTime = timestamp;
    const duration = timestamp - this._currentSegment.startTime;

    // Only keep segments that are at least 1 second long
    if (duration >= 1000) {
      this._completedSegments.push({ ...this._currentSegment });
    }

    this._currentSegment = null;
  }
}

module.exports = { SegmentEngine };
