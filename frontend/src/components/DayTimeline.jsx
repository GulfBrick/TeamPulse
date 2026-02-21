import React, { useState } from 'react';
import { colors, formatTime } from './UI';

const HOUR_START = 6; // 6 AM
const HOUR_END = 22; // 10 PM
const TOTAL_HOURS = HOUR_END - HOUR_START;

const segmentColors = {
  active: '#22c55e',
  idle: '#eab308',
  app_usage: '#3b82f6',
  offline: '#23252f',
};

/**
 * DayTimeline — Horizontal timeline bar showing colored blocks per segment.
 *
 * Props:
 *   segments: ActivitySegment[] from API
 *   onSegmentClick: (segment) => void (optional)
 *   compact: boolean — smaller height for overview lists
 */
export default function DayTimeline({ segments = [], onSegmentClick, compact = false }) {
  const [tooltip, setTooltip] = useState(null);
  const barHeight = compact ? 28 : 40;

  // Convert segments to positioned blocks
  const blocks = segments.map((seg, i) => {
    const start = new Date(seg.start_time);
    const end = new Date(seg.end_time);

    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    // Clamp to visible range
    const clampedStart = Math.max(startHour, HOUR_START);
    const clampedEnd = Math.min(endHour, HOUR_END);

    if (clampedEnd <= clampedStart) return null;

    const leftPct = ((clampedStart - HOUR_START) / TOTAL_HOURS) * 100;
    const widthPct = ((clampedEnd - clampedStart) / TOTAL_HOURS) * 100;

    return {
      key: seg.id || i,
      segment: seg,
      left: `${leftPct}%`,
      width: `${Math.max(widthPct, 0.3)}%`,
      color: segmentColors[seg.segment_type] || segmentColors.active,
    };
  }).filter(Boolean);

  // Time axis labels
  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h += 2) {
    const leftPct = ((h - HOUR_START) / TOTAL_HOURS) * 100;
    hours.push({ label: `${h}:00`, left: `${leftPct}%` });
  }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Timeline bar */}
      <div style={{
        position: 'relative',
        height: barHeight,
        background: colors.bg,
        borderRadius: '6px',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`,
      }}>
        {blocks.map(block => (
          <div
            key={block.key}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: block.left,
              width: block.width,
              background: block.color,
              opacity: 0.85,
              cursor: onSegmentClick ? 'pointer' : 'default',
              transition: 'opacity 0.15s',
              borderRight: '1px solid rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                segment: block.segment,
                x: rect.left + rect.width / 2,
                y: rect.top,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => onSegmentClick?.(block.segment)}
          />
        ))}

        {/* Empty state */}
        {blocks.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', color: colors.textDimmer,
          }}>
            No activity data
          </div>
        )}
      </div>

      {/* Time axis */}
      {!compact && (
        <div style={{ position: 'relative', height: '20px', marginTop: '4px' }}>
          {hours.map(h => (
            <span key={h.label} style={{
              position: 'absolute',
              left: h.left,
              fontSize: '10px',
              color: colors.textDimmer,
              transform: 'translateX(-50%)',
            }}>
              {h.label}
            </span>
          ))}
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
          {Object.entries({ Active: segmentColors.active, Idle: segmentColors.idle, App: segmentColors.app_usage }).map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: color }} />
              <span style={{ fontSize: '11px', color: colors.textDim }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y - 10,
          transform: 'translate(-50%, -100%)',
          background: colors.card,
          border: `1px solid ${colors.borderLight}`,
          borderRadius: '8px',
          padding: '10px 14px',
          zIndex: 1000,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          minWidth: '180px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: colors.text, marginBottom: '4px' }}>
            {tooltip.segment.app_name || tooltip.segment.segment_type}
          </div>
          {tooltip.segment.window_title && (
            <div style={{ fontSize: '11px', color: colors.textDim, marginBottom: '6px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tooltip.segment.window_title}
            </div>
          )}
          <div style={{ fontSize: '11px', color: colors.textMuted, marginBottom: '4px' }}>
            {new Date(tooltip.segment.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            {' — '}
            {new Date(tooltip.segment.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            {' '}
            ({formatTime(tooltip.segment.duration_seconds || 0)})
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: colors.textDim }}>
            {tooltip.segment.mouse_clicks > 0 && <span>{tooltip.segment.mouse_clicks} clicks</span>}
            {tooltip.segment.keystrokes > 0 && <span>{tooltip.segment.keystrokes} keys</span>}
            {tooltip.segment.mouse_moves > 0 && <span>{tooltip.segment.mouse_moves} moves</span>}
          </div>
        </div>
      )}
    </div>
  );
}
