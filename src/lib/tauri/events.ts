// Rust tells every window what changed. Started once per window, outside React, so a remount never doubles it.

import {listen, type UnlistenFn} from '@tauri-apps/api/event';
import type {Context, PomodoroSnapshot, Project, Settings, TasksChanged} from '@/lib/domain/types';
import {useData} from '@/lib/store/data';
import {commands} from './commands';

let started: Promise<UnlistenFn[]> | null = null;

export function startEventBridge() {
  started ??= Promise.all([
    listen<TasksChanged>('tasks:changed', ({payload}) => {
      useData.getState().upsertTasks(payload.upserted);
      useData.getState().removeTasks(payload.deleted);
    }),
    listen<Project[]>('projects:changed', ({payload}) => useData.getState().setProjects(payload)),
    listen<Context[]>('contexts:changed', ({payload}) => useData.getState().setContexts(payload)),
    listen<Settings>('settings:changed', ({payload}) => useData.getState().setSettings(payload)),
    listen<PomodoroSnapshot>('pomodoro:state', ({payload}) => useData.getState().setPomodoro(payload)),
  ]);
  // A hidden window can miss events while WebKit suspends it; catch up whenever it comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reload();
  });
  return started;
}

export async function reload() {
  useData.getState().hydrate(await commands.bootstrap());
}

/** Sends uncaught errors to the app's log, where they can be read outside the webview. */
export function reportErrors() {
  const send = (message: string) => void commands.log(message).catch(() => {});
  window.addEventListener('error', event => send(`${event.message} at ${event.filename}:${event.lineno}`));
  window.addEventListener('unhandledrejection', event => send(`Unhandled: ${String(event.reason)}`));
}
