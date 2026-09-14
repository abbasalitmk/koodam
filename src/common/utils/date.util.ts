import { AppException } from './app.exception';
import { ErrorCode } from './error-codes';

export const MAX_EVENT_DURATION_MINUTES = 8 * 60;

/**
 * Koodam's strict single-day policy: a gathering starts and ends on the same
 * calendar date in its own timezone, and runs for at most eight hours.
 */
export function assertSingleDaySchedule(start: Date, end: Date, timezone = 'Asia/Kolkata'): void {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Invalid start or end time');
  }

  if (end.getTime() <= start.getTime()) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'End time must be after start time');
  }

  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
  if (durationMinutes > MAX_EVENT_DURATION_MINUTES) {
    throw AppException.badRequest(
      ErrorCode.EVENT_NOT_SINGLE_DAY,
      'Koodam gatherings run for a maximum of 8 hours',
    );
  }

  if (calendarDateIn(start, timezone) !== calendarDateIn(end, timezone)) {
    throw AppException.badRequest(
      ErrorCode.EVENT_NOT_SINGLE_DAY,
      'Koodam gatherings must start and end on the same calendar day',
    );
  }
}

export function assertNotInPast(start: Date, graceMinutes = 5): void {
  if (start.getTime() < Date.now() - graceMinutes * 60_000) {
    throw AppException.badRequest(ErrorCode.EVENT_IN_PAST, 'Events cannot be scheduled in the past');
  }
}

/** YYYY-MM-DD for the given instant, evaluated in the supplied IANA timezone. */
export function calendarDateIn(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function calculateAge(dateOfBirth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export function addDays(date: Date, days: number): Date {
  return addHours(date, days * 24);
}
