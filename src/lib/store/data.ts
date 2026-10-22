// What Rust holds, mirrored in the window. Rust is the source of truth: every change it makes arrives as an event and
// lands here, including the echo of this window's own changes.

import {create} from 'zustand';
import type {Bootstrap, Context, PomodoroSnapshot, Project, Settings, Task} from '@/lib/domain/types';

interface DataState {
  loaded: boolean;
  tasks: Record<number, Task>;
  projects: Project[];
  contexts: Context[];
  settings: Settings | null;
  pomodoro: PomodoroSnapshot | null;
  hydrate: (data: Bootstrap) => void;
  upsertTasks: (tasks: Task[]) => void;
  removeTasks: (ids: number[]) => void;
  setProjects: (projects: Project[]) => void;
  setContexts: (contexts: Context[]) => void;
  setSettings: (settings: Settings) => void;
  setPomodoro: (pomodoro: PomodoroSnapshot) => void;
}

export const useData = create<DataState>()(set => ({
  loaded: false,
  tasks: {},
  projects: [],
  contexts: [],
  settings: null,
  pomodoro: null,
  hydrate: data => set({
    loaded: true,
    tasks: Object.fromEntries(data.tasks.map(t => [t.id, t])),
    projects: data.projects,
    contexts: data.contexts,
    settings: data.settings,
    pomodoro: data.pomodoro,
  }),
  upsertTasks: tasks => set(state => {
    if (!tasks.length) return state;
    const next = {...state.tasks};
    for (const task of tasks) next[task.id] = task;
    return {tasks: next};
  }),
  removeTasks: ids => set(state => {
    if (!ids.length) return state;
    const next = {...state.tasks};
    for (const id of ids) delete next[id];
    return {tasks: next};
  }),
  setProjects: projects => set({projects}),
  setContexts: contexts => set({contexts}),
  setSettings: settings => set({settings}),
  setPomodoro: pomodoro => set({pomodoro}),
}));

/** Settings exist once the window has loaded, which is before anything that reads them renders. */
export function useSettings(): Settings {
  const settings = useData(s => s.settings);
  if (!settings) throw new Error('Settings read before the app loaded');
  return settings;
}

export const getSettings = (): Settings => {
  const settings = useData.getState().settings;
  if (!settings) throw new Error('Settings read before the app loaded');
  return settings;
};
