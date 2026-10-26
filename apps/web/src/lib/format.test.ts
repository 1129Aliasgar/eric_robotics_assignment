import { describe, expect, it } from 'vitest';
import {
  clamp,
  cx,
  formatDuration,
  formatEta,
  formatMeters,
  formatPercent,
  lerp,
  lerpAngle,
  titleCase,
} from './format';

describe('format helpers', () => {
  it('formats mission durations', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3661)).toBe('1h 01m');
    expect(formatDuration(-5)).toBe('00:00');
  });

  it('formats ETAs', () => {
    expect(formatEta(0)).toBe('Arriving');
    expect(formatEta(Number.POSITIVE_INFINITY)).toBe('Arriving');
    expect(formatEta(45)).toBe('~45s');
    expect(formatEta(125)).toBe('~2m 05s');
  });

  it('formats distances and percentages', () => {
    expect(formatMeters(9.94)).toBe('9.9 m');
    expect(formatMeters(10)).toBe('10 m');
    expect(formatMeters(Number.NaN)).toBe('—');
    expect(formatPercent(99.5)).toBe('100%');
  });

  it('clamps and interpolates values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(lerpAngle(3.1, -3.1, 0.5)).toBeCloseTo(3.14159265, 4);
  });

  it('joins class names and title-cases labels', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
    expect(titleCase('manual')).toBe('Manual');
  });
});
