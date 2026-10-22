// The one place that calls into Rust. Each function names a command in src-tauri/src/commands.

import {invoke} from '@tauri-apps/api/core';
import type {
  Bootstrap, Context, NewTask, PomodoroSnapshot, Project, Session, Settings, Task, TaskPatch, TaskStatus,
} from '@/lib/domain/types';

export const commands = {
  bootstrap: () => invoke<Bootstrap>('app_bootstrap'),
  updateSettings: (patch: Partial<Settings>) => invoke<Settings>('settings_update', {patch}),
  dismissCapture: () => invoke<void>('capture_dismiss'),
  log: (message: string) => invoke<void>('client_log', {message}),

  createTask: (input: NewTask) => invoke<Task>('task_create', {input}),
  updateTask: (id: number, patch: TaskPatch) => invoke<Task>('task_update', {id, patch}),
  /** Drops a task between two neighbours: prevId above it, nextId below it. */
  moveTask: (id: number, status: TaskStatus, prevId: number | null, nextId: number | null) =>
    invoke<Task[]>('task_move', {id, status, prevId, nextId}),
  deleteTask: (id: number) => invoke<void>('task_delete', {id}),
  restoreTask: (id: number) => invoke<Task>('task_restore', {id}),
  taskSessions: (id: number) => invoke<Session[]>('task_sessions', {id}),
  focusSessionsSince: (since: number) => invoke<number>('focus_sessions_since', {since}),

  createProject: (name: string, outcome = '') => invoke<Project>('project_create', {name, outcome}),
  updateProject: (id: number, patch: {name?: string; outcome?: string; completed?: boolean}) =>
    invoke<Project[]>('project_update', {id, patch}),
  deleteProject: (id: number) => invoke<Project[]>('project_delete', {id}),
  restoreProject: (id: number) => invoke<Project[]>('project_restore', {id}),

  createContext: (name: string) => invoke<Context>('context_create', {name}),
  renameContext: (id: number, name: string) => invoke<Context[]>('context_rename', {id, name}),
  deleteContext: (id: number) => invoke<Context[]>('context_delete', {id}),
  restoreContext: (id: number) => invoke<Context[]>('context_restore', {id}),

  pomodoroStart: (taskId: number | null = null) => invoke<PomodoroSnapshot>('pomodoro_start', {taskId}),
  pomodoroPause: () => invoke<PomodoroSnapshot>('pomodoro_pause'),
  pomodoroResume: () => invoke<PomodoroSnapshot>('pomodoro_resume'),
  pomodoroSkip: () => invoke<PomodoroSnapshot>('pomodoro_skip'),
  pomodoroReset: () => invoke<PomodoroSnapshot>('pomodoro_reset'),
  pomodoroLink: (taskId: number | null) => invoke<PomodoroSnapshot>('pomodoro_link', {taskId}),
};

/** Rust sends errors as plain sentences; anything else becomes one. */
export function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
