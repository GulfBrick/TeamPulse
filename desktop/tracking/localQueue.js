/**
 * LocalQueue — JSON file-backed offline queue for segment data.
 *
 * Segments are stored locally when network is unavailable and retried next tick.
 * Uses a simple JSON file in the app's userData directory.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_QUEUE_SIZE = 10_000;

class LocalQueue {
  constructor() {
    this._queue = [];
    this._nextId = 1;
    this._filePath = path.join(app.getPath('userData'), 'segment_queue.json');
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this._filePath)) {
        const data = JSON.parse(fs.readFileSync(this._filePath, 'utf-8'));
        this._queue = data.queue || [];
        this._nextId = data.nextId || 1;
        console.log(`LocalQueue: loaded ${this._queue.length} queued segments from disk`);
      }
    } catch (err) {
      console.error('LocalQueue: failed to load from disk:', err.message);
      this._queue = [];
      this._nextId = 1;
    }
  }

  _save() {
    try {
      fs.writeFileSync(this._filePath, JSON.stringify({
        queue: this._queue,
        nextId: this._nextId,
      }));
    } catch (err) {
      console.error('LocalQueue: failed to save to disk:', err.message);
    }
  }

  /**
   * Store completed segments locally.
   */
  enqueue(segments) {
    if (!segments || segments.length === 0) return;

    for (const seg of segments) {
      this._queue.push({ id: this._nextId++, segment: seg });
    }

    // Prune if over limit
    if (this._queue.length > MAX_QUEUE_SIZE) {
      this._queue.splice(0, this._queue.length - MAX_QUEUE_SIZE);
    }

    this._save();
  }

  /**
   * Get oldest N unsent segments.
   * Returns array of { id, segment } objects.
   */
  dequeue(batchSize = 50) {
    return this._queue.slice(0, batchSize);
  }

  /**
   * Remove sent segments from queue by their IDs.
   */
  markSent(ids) {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    this._queue = this._queue.filter(item => !idSet.has(item.id));
    this._save();
  }

  /**
   * Get current queue size.
   */
  size() {
    return this._queue.length;
  }

  /**
   * Flush to disk on close.
   */
  close() {
    this._save();
  }
}

module.exports = { LocalQueue };
