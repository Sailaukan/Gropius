// What the board window shows: the view, the open task, the filters and which overlays are open. The view and the
// open task live in the URL hash, so cards and rows are real links (#/board?task=12).

import {create} from 'zustand';
import type {NewTask, TaskStatus} from '@/lib/domain/types';

export type View = 'inbox' | 'today' | 'board' | 'review' | 'projects';
export const VIEWS: View[] = ['inbox', 'today', 'board', 'review', 'projects'];

export type FilterField = 'project' | 'context' | 'priority' | 'due';
export type Filters = {search: string} & Record<FilterField, string[]>;
const NO_FILTERS: Filters = {search: '', project: [], context: [], priority: [], due: []};

export type SettingsTab = 'general' | 'board' | 'pomodoro' | 'contexts' | 'shortcuts';

interface Route {
  view: View;
  /** The id of the task open in the details sheet. */
  task: number | null;
}

interface UiState extends Route {
  focusedTaskId: number | null;
  filters: Filters;
  newTask: {open: boolean; defaults: Partial<NewTask>};
  settings: {open: boolean; tab: SettingsTab};
  paletteOpen: boolean;
  projectDialogOpen: boolean;
  /** Done and Cancelled show recent tasks; this shows the older ones too. */
  showOlder: Partial<Record<TaskStatus, boolean>>;
  setFilters: (filters: Partial<Filters>) => void;
  clearFilters: () => void;
  focusTask: (id: number | null) => void;
  openNewTask: (defaults?: Partial<NewTask>) => void;
  closeNewTask: () => void;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTab) => void;
  setPaletteOpen: (open: boolean) => void;
  setProjectDialogOpen: (open: boolean) => void;
  toggleOlder: (status: TaskStatus) => void;
}

export function href(view: View, task?: number | null): string {
  return task ? `#/${view}?task=${task}` : `#/${view}`;
}

function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const view = (VIEWS as string[]).includes(path) ? (path as View) : 'board';
  const task = Number(new URLSearchParams(query).get('task'));
  return {view, task: Number.isInteger(task) && task > 0 ? task : null};
}

export const useUi = create<UiState>()(set => ({
  ...parse(window.location.hash),
  focusedTaskId: null,
  filters: NO_FILTERS,
  newTask: {open: false, defaults: {}},
  settings: {open: false, tab: 'general'},
  paletteOpen: false,
  projectDialogOpen: false,
  showOlder: {},
  setFilters: filters => set(state => ({filters: {...state.filters, ...filters}})),
  clearFilters: () => set({filters: NO_FILTERS}),
  focusTask: id => set({focusedTaskId: id}),
  openNewTask: (defaults = {}) => set({newTask: {open: true, defaults}}),
  closeNewTask: () => set(state => ({newTask: {...state.newTask, open: false}})),
  openSettings: tab => set(state => ({settings: {open: true, tab: tab ?? state.settings.tab}})),
  closeSettings: () => set(state => ({settings: {...state.settings, open: false}})),
  setSettingsTab: tab => set(state => ({settings: {...state.settings, tab}})),
  setPaletteOpen: paletteOpen => set({paletteOpen}),
  setProjectDialogOpen: projectDialogOpen => set({projectDialogOpen}),
  toggleOlder: status => set(state => ({showOlder: {...state.showOlder, [status]: !state.showOlder[status]}})),
}));

/** Goes to a view, and opens or closes a task beside it. */
export function navigate(view: View, task: number | null = null) {
  window.location.hash = href(view, task);
}

export const closeTask = () => navigate(useUi.getState().view);

/** Narrows the board to one project or context, clearing every other filter. */
export function filterBoard(field: 'project' | 'context', id: number) {
  useUi.getState().setFilters({...NO_FILTERS, [field]: [String(id)]});
}

window.addEventListener('hashchange', () => useUi.setState(parse(window.location.hash)));
