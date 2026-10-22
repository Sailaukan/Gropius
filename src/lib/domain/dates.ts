// Due dates are local calendar days written YYYY-MM-DD, so they never shift with the time zone.

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toDay(new Date());

export function addDays(day: string, days: number): string {
  const date = fromDay(day);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

/** Whole calendar days from a to b; negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / DAY_MS);
}

/** Local midnight today, as epoch milliseconds. */
export function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** The last day of the week that holds `day`, for "This week". */
export function endOfWeek(day: string, weekStartsOn: 0 | 1): string {
  const weekday = fromDay(day).getDay();
  const fromStart = (weekday - weekStartsOn + 7) % 7;
  return addDays(day, 6 - fromStart);
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later';

export function dueState(dueDate: string, now = today()): DueState {
  const days = daysBetween(now, dueDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days < 7) return 'soon';
  return 'later';
}

/** "2 days overdue", "Due today", "Tomorrow", "Friday" or "Oct 24". */
export function dueLabel(dueDate: string, now = today()): string {
  const days = daysBetween(now, dueDate);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return '1 day overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  const date = fromDay(dueDate);
  if (days < 7) return date.toLocaleDateString(undefined, {weekday: 'long'});
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric'});
}

/** "Oct 16" for a moment, with the year when it is not this one. */
export function shortDate(ms: number): string {
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric'});
}

export const daysAgo = (ms: number, now = Date.now()) => Math.floor((now - ms) / DAY_MS);
