// Pure views over the task list: board columns, the inbox, stalled work, what is due.

import {closedAt, isClosed, STATUSES, taskKey} from './status';
import {DAY_MS, dueState, endOfWeek, startOfToday, today} from './dates';
import {priorityRank} from './priority';
import type {Context, Project, Task, TaskStatus} from './types';

/** A column's order: open columns as arranged, closed ones newest first. */
export function sortColumn(tasks: Task[], status: TaskStatus): Task[] {
  return isClosed(status)
    ? [...tasks].sort((a, b) => (closedAt(b) ?? 0) - (closedAt(a) ?? 0))
    : [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function byStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = Object.fromEntries(STATUSES.map(s => [s, [] as Task[]])) as Record<TaskStatus, Task[]>;
  for (const task of tasks) groups[task.status].push(task);
  for (const status of STATUSES) groups[status] = sortColumn(groups[status], status);
  return groups;
}

/** A closed task older than the window the settings keep on the board. */
export function isOld(task: Task, completedDays: number | null, now = Date.now()): boolean {
  const closed = closedAt(task);
  return completedDays !== null && closed !== null && closed < now - completedDays * DAY_MS;
}

/** Captured and not yet looked at: the GTD inbox. */
export const isInbox = (task: Task) => task.status === 'backlog' && task.processedAt === null;

/** Todo or In progress with no activity, and no review, for the stalled window. */
export function isStalled(task: Task, stalledDays: number, now = Date.now()): boolean {
  if (task.status !== 'todo' && task.status !== 'in_progress') return false;
  const cutoff = now - stalledDays * DAY_MS;
  return task.activityAt < cutoff && (task.reviewedAt ?? 0) < cutoff;
}

/** Backlog tasks the weekly review should look at: new captures and anything not reviewed in a week. */
export function needsBacklogReview(task: Task, now = Date.now()): boolean {
  return task.status === 'backlog' && (task.processedAt === null || (task.reviewedAt ?? 0) < now - 7 * DAY_MS);
}

/** The values a task has for the Due filter: overdue, today, week and none. */
export function dueValues(task: Task, weekStartsOn: 0 | 1, now = today()): string[] {
  if (!task.dueDate) return ['none'];
  if (isClosed(task.status)) return [];
  const state = dueState(task.dueDate, now);
  const values: string[] = [];
  if (state === 'overdue') values.push('overdue');
  if (state === 'today') values.push('today');
  if (state !== 'overdue' && task.dueDate <= endOfWeek(now, weekStartsOn)) values.push('week');
  return values;
}

export function matchesSearch(task: Task, query: string, projects: Map<number, Project>, contexts: Map<number, Context>) {
  const haystack = [
    task.title,
    task.description,
    taskKey(task.seq),
    task.projectId ? projects.get(task.projectId)?.name : '',
    ...task.contextIds.map(id => contexts.get(id)?.name ?? ''),
  ].join(' ').toLowerCase();
  return query.split(/\s+/).every(word => haystack.includes(word));
}

export interface TodayBuckets {
  overdue: Task[];
  dueToday: Task[];
  doneToday: Task[];
}

export function todayBuckets(tasks: Task[]): TodayBuckets {
  const now = today();
  const midnight = startOfToday();
  const byUrgency = (a: Task, b: Task) =>
    priorityRank(a.priority) - priorityRank(b.priority) || (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  const open = tasks.filter(t => t.dueDate && !isClosed(t.status));
  return {
    overdue: open.filter(t => dueState(t.dueDate!, now) === 'overdue').sort(byUrgency),
    dueToday: open.filter(t => dueState(t.dueDate!, now) === 'today').sort(byUrgency),
    doneToday: tasks.filter(t => t.status === 'done' && (t.completedAt ?? 0) >= midnight)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
  };
}

export interface ProjectStats {
  open: number;
  done: number;
  /** A project with open tasks but none in Todo or In progress has stalled: GTD says every project needs a next action. */
  hasNextAction: boolean;
}

export function projectStats(tasks: Task[]): Map<number, ProjectStats> {
  const stats = new Map<number, ProjectStats>();
  for (const task of tasks) {
    if (task.projectId === null) continue;
    const entry = stats.get(task.projectId) ?? {open: 0, done: 0, hasNextAction: false};
    if (task.status === 'done') entry.done += 1;
    else if (task.status !== 'cancelled') entry.open += 1;
    if (task.status === 'todo' || task.status === 'in_progress') entry.hasNextAction = true;
    stats.set(task.projectId, entry);
  }
  return stats;
}
