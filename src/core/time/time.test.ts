import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  dateKeyIn,
  formatDuration,
  formatHoursDecimal,
  instantFromLocal,
  minutesBetween,
  offsetMinutes,
  relative,
  shiftDateKey,
  timeIn,
  zoneShiftMinutes,
} from './time';

describe('formatDuration', () => {
  it('formats hours and minutes the way a pilot reads them', () => {
    expect(formatDuration(318)).toBe('5h 18m');
    expect(formatDuration(48)).toBe('48m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(0)).toBe('0m');
  });

  it('keeps the sign on negative durations', () => {
    expect(formatDuration(-95)).toBe('-1h 35m');
  });

  it('renders unknown as unknown rather than zero', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(NaN)).toBe('—');
  });
});

describe('formatHoursDecimal', () => {
  it('matches logbook decimal convention', () => {
    expect(formatHoursDecimal(96)).toBe('1.6');
    expect(formatHoursDecimal(60)).toBe('1.0');
    expect(formatHoursDecimal(null)).toBe('—');
  });
});

describe('instantFromLocal', () => {
  it('resolves a wall-clock time in a named zone to the right instant', () => {
    // 06:00 EDT on 18 Sep 2026 is 10:00Z.
    const d = instantFromLocal('2026-09-18', '06:00', 'America/New_York');
    expect(d?.toISOString()).toBe('2026-09-18T10:00:00.000Z');
  });

  it('handles standard time on the other side of the DST boundary', () => {
    // 06:00 EST on 18 Jan 2026 is 11:00Z.
    const d = instantFromLocal('2026-01-18', '06:00', 'America/New_York');
    expect(d?.toISOString()).toBe('2026-01-18T11:00:00.000Z');
  });

  it('handles a zone that does not observe DST', () => {
    // Phoenix is UTC-7 all year.
    const summer = instantFromLocal('2026-07-15', '06:00', 'America/Phoenix');
    const winter = instantFromLocal('2026-01-15', '06:00', 'America/Phoenix');
    expect(summer?.toISOString()).toBe('2026-07-15T13:00:00.000Z');
    expect(winter?.toISOString()).toBe('2026-01-15T13:00:00.000Z');
  });

  it('rejects malformed input rather than guessing', () => {
    expect(instantFromLocal('not-a-date', '06:00', 'UTC')).toBeNull();
    expect(instantFromLocal('2026-09-18', '25:00', 'UTC')).toBeNull();
    expect(instantFromLocal('2026-09-18', '06:99', 'UTC')).toBeNull();
  });

  it('round-trips through timeIn', () => {
    const d = instantFromLocal('2026-09-18', '05:15', 'America/New_York')!;
    expect(timeIn(d, 'America/New_York')).toBe('05:15');
  });
});

describe('offsetMinutes and zoneShiftMinutes', () => {
  it('reports the UTC offset for a zone at an instant', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    const winter = new Date('2026-01-15T12:00:00Z');
    expect(offsetMinutes(summer, 'America/New_York')).toBe(-240);
    expect(offsetMinutes(winter, 'America/New_York')).toBe(-300);
    expect(offsetMinutes(summer, 'UTC')).toBe(0);
  });

  it('reports the clock change flying between zones', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    // Eastern to Central in July: clocks go back an hour.
    expect(zoneShiftMinutes(summer, 'America/New_York', 'America/Chicago')).toBe(-60);
    // Eastern to Phoenix in July: Arizona has no DST, so it is three hours.
    expect(zoneShiftMinutes(summer, 'America/New_York', 'America/Phoenix')).toBe(-180);
  });
});

describe('minutesBetween', () => {
  it('measures across a timezone-crossing leg correctly', () => {
    // 08:15 EDT CLT to 09:32 EDT DCA is 77 minutes.
    const dep = instantFromLocal('2026-09-18', '08:15', 'America/New_York')!;
    const arr = instantFromLocal('2026-09-18', '09:32', 'America/New_York')!;
    expect(minutesBetween(dep, arr)).toBe(77);
  });

  it('accounts for the clock change on an eastbound leg', () => {
    // 09:00 CDT Chicago to 12:00 EDT Charlotte is two hours, not three.
    const dep = instantFromLocal('2026-09-18', '09:00', 'America/Chicago')!;
    const arr = instantFromLocal('2026-09-18', '12:00', 'America/New_York')!;
    expect(minutesBetween(dep, arr)).toBe(120);
  });

  it('is null when either end is unknown', () => {
    expect(minutesBetween(null, new Date())).toBeNull();
    expect(minutesBetween(new Date(), null)).toBeNull();
  });
});

describe('dateKeyIn and shiftDateKey', () => {
  it('reports the local calendar date, not the UTC one', () => {
    // 02:00Z on 19 Sep is still 18 Sep in New York.
    const instant = new Date('2026-09-19T02:00:00Z');
    expect(dateKeyIn(instant, 'America/New_York')).toBe('2026-09-18');
    expect(dateKeyIn(instant, 'UTC')).toBe('2026-09-19');
  });

  it('shifts dates across month and year boundaries', () => {
    expect(shiftDateKey('2026-09-18', 1)).toBe('2026-09-19');
    expect(shiftDateKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('relative', () => {
  const now = new Date('2026-09-18T10:00:00Z');
  it('phrases future and past plainly', () => {
    expect(relative(addMinutes(now, 192), now)).toBe('in 3h 12m');
    expect(relative(addMinutes(now, -120), now)).toBe('2h ago');
    expect(relative(now, now)).toBe('now');
  });
});
