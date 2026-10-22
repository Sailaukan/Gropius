// Development only: when the board is opened in a plain browser (no Tauri), this stands in for the Rust commands with
// an in-memory copy, so the UI can be previewed and screenshotted. It never ships: main.tsx imports it only in dev and
// outside Tauri.

import {mockIPC, mockWindows} from '@tauri-apps/api/mocks';
import {emit} from '@tauri-apps/api/event';
import type {Context, PomodoroSnapshot, Project, Settings, Task, TaskStatus} from '@/lib/domain/types';
import {addDays, today} from '@/lib/domain/dates';
import {useUi} from '@/lib/store/ui';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (days: number, hours = 0) => now - days * DAY - hours * 60 * 60 * 1000;

const settings: Settings = {
  visibleColumns: ['backlog', 'todo', 'in_progress', 'done'],
  showEmptyColumns: true,
  completedDays: 14,
  wipLimit: 3,
  stalledDays: 7,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  moveToInProgress: true,
  soundEnabled: true,
  showTimeInMenuBar: true,
  theme: (new URLSearchParams(location.search).get('theme') as Settings['theme']) ?? 'system',
  captureShortcut: 'Alt+Shift+Space',
  weekStartsOn: 1,
  lastReviewAt: ago(9),
  sidebarCollapsed: false,
};

let projects: Project[] = [
  {id: 1, name: 'Kitchen renovation', outcome: 'New cabinets in, old ones sold.', createdAt: ago(30), completedAt: null},
  {id: 2, name: 'Q4 planning', outcome: 'The team agrees on three goals for the quarter.', createdAt: ago(12), completedAt: null},
  {id: 3, name: 'Half marathon', outcome: 'Finish the Almaty half under two hours.', createdAt: ago(60), completedAt: null},
];
let contexts: Context[] = [
  {id: 1, name: '@calls'}, {id: 2, name: '@computer'}, {id: 3, name: '@errands'}, {id: 4, name: '@home'},
];

let seq = 0;
function task(title: string, status: TaskStatus, extra: Partial<Task> = {}): Task {
  seq += 1;
  const created = extra.createdAt ?? ago(seq % 9, seq);
  return {
    id: seq, seq, title, description: '', status, sortOrder: seq * 1024, priority: 0, projectId: null, contextIds: [],
    dueDate: null, createdAt: created, updatedAt: created, activityAt: extra.activityAt ?? created, startedAt: null,
    completedAt: null, cancelledAt: null, processedAt: created, reviewedAt: null, pomodorosCompleted: 0, ...extra,
  };
}

const tasks = new Map<number, Task>([
  task('Fix the gate latch', 'backlog', {processedAt: null, createdAt: ago(0, 3)}),
  task('Call Dana about the lease', 'backlog', {processedAt: null, createdAt: ago(1)}),
  task('Look into a standing desk', 'backlog', {processedAt: null, createdAt: ago(2)}),
  task('Learn twenty Kazakh phrases', 'backlog', {priority: 4, createdAt: ago(20), reviewedAt: ago(9)}),
  task('Replace the bike chain', 'backlog', {contextIds: [3], createdAt: ago(16)}),
  task('Draft the Q4 plan for the team', 'todo', {priority: 1, projectId: 2, dueDate: today(), contextIds: [2],
    description: 'Three goals, one owner each. Share the draft before Thursday.'}),
  task('Book the car service', 'todo', {priority: 2, dueDate: addDays(today(), 1), contextIds: [1]}),
  task('Renew passport', 'todo', {priority: 2, dueDate: addDays(today(), -2), contextIds: [3]}),
  task('Order cabinet handles', 'todo', {projectId: 1, contextIds: [2], dueDate: addDays(today(), 5)}),
  task('Plan long run routes for November', 'todo', {projectId: 3, priority: 3, activityAt: ago(11), createdAt: ago(14)}),
  task('Write the onboarding guide', 'in_progress', {priority: 3, contextIds: [2], pomodorosCompleted: 3, startedAt: ago(2)}),
  task('Compare tile quotes', 'in_progress', {projectId: 1, startedAt: ago(9), activityAt: ago(9), createdAt: ago(12)}),
  task('Pay the electricity bill', 'done', {completedAt: ago(0, 2), contextIds: [2]}),
  task('Book flights to Istanbul', 'done', {completedAt: ago(2), pomodorosCompleted: 1}),
  task('Send the invoice to Aster Labs', 'done', {completedAt: ago(5), priority: 2}),
  task('Try the new budgeting app', 'cancelled', {cancelledAt: ago(3)}),
].map(t => [t.id, t]));

let pomodoro: PomodoroSnapshot = {
  phase: 'focus', status: 'running', endsAt: now + 18 * 60 * 1000 + 42 * 1000, remainingMs: 18 * 60 * 1000 + 42 * 1000,
  plannedMs: 25 * 60 * 1000, completedInCycle: 1, longBreakEvery: 4, task: {id: 11, seq: 11, title: 'Write the onboarding guide'},
};

type Args = Record<string, unknown>;

function upsert(t: Task) {
  tasks.set(t.id, t);
  void emit('tasks:changed', {upserted: [t], deleted: []});
  return t;
}

function top(status: TaskStatus) {
  const orders = [...tasks.values()].filter(t => t.status === status).map(t => t.sortOrder);
  return orders.length ? Math.min(...orders) - 1024 : 0;
}

function withStatus(t: Task, status: TaskStatus): Task {
  if (status === t.status) return t;
  return {
    ...t, status,
    completedAt: status === 'done' ? Date.now() : null,
    cancelledAt: status === 'cancelled' ? Date.now() : null,
    startedAt: t.startedAt ?? (status === 'in_progress' ? Date.now() : null),
    processedAt: t.processedAt ?? Date.now(),
  };
}

const handlers: Record<string, (args: Args) => unknown> = {
  app_bootstrap: () => ({tasks: [...tasks.values()], projects, contexts, settings, pomodoro}),
  settings_update: ({patch}) => {
    Object.assign(settings, patch);
    void emit('settings:changed', settings);
    return settings;
  },
  task_create: ({input}) => {
    const {processed, title, ...fields} = input as Partial<Task> & {processed?: boolean};
    const status = fields.status ?? 'backlog';
    return upsert(task(String(title).trim(), status, {
      ...fields, sortOrder: top(status), createdAt: Date.now(), processedAt: processed === false ? null : Date.now(),
    }));
  },
  task_update: ({id, patch}) => {
    const p = patch as Partial<Task> & {processed?: boolean; reviewed?: boolean};
    let t = tasks.get(Number(id))!;
    const {status, processed, reviewed, ...rest} = p;
    t = {...t, ...rest, updatedAt: Date.now(), activityAt: Date.now()};
    if (status && status !== t.status) t = {...withStatus(t, status), sortOrder: top(status)};
    if (processed || reviewed) t = {...t, processedAt: t.processedAt ?? Date.now()};
    if (reviewed) t = {...t, reviewedAt: Date.now()};
    return upsert(t);
  },
  task_move: ({id, status, prevId, nextId}) => {
    const t = tasks.get(Number(id))!;
    const above = prevId ? tasks.get(Number(prevId))?.sortOrder : undefined;
    const below = nextId ? tasks.get(Number(nextId))?.sortOrder : undefined;
    const sortOrder = above !== undefined && below !== undefined ? (above + below) / 2
      : above !== undefined ? above + 1024 : below !== undefined ? below - 1024 : top(status as TaskStatus);
    return [upsert({...withStatus(t, status as TaskStatus), sortOrder, updatedAt: Date.now(), activityAt: Date.now()})];
  },
  task_delete: ({id}) => {
    tasks.delete(Number(id));
    void emit('tasks:changed', {upserted: [], deleted: [Number(id)]});
  },
  task_sessions: ({id}) => Array.from({length: tasks.get(Number(id))?.pomodorosCompleted ?? 0}, (_, i) => ({
    id: i + 1, taskId: Number(id), phase: 'focus', plannedMs: 25 * 60 * 1000, startedAt: ago(i, 2), endedAt: ago(i, 1.5), completed: true,
  })),
  focus_sessions_since: () => 3,
  project_create: ({name, outcome}) => {
    const p = {id: projects.length + 1, name: String(name), outcome: String(outcome ?? ''), createdAt: Date.now(), completedAt: null};
    projects = [...projects, p];
    void emit('projects:changed', projects);
    return p;
  },
  project_update: ({id, patch}) => {
    const p = patch as {name?: string; outcome?: string; completed?: boolean};
    projects = projects.map(x => x.id === id ? {
      ...x, ...(p.name ? {name: p.name} : {}), ...(p.outcome !== undefined ? {outcome: p.outcome} : {}),
      ...(p.completed !== undefined ? {completedAt: p.completed ? Date.now() : null} : {}),
    } : x);
    return projects;
  },
  project_delete: ({id}) => (projects = projects.filter(p => p.id !== id)),
  context_create: ({name}) => {
    const c = {id: contexts.length + 1, name: `@${String(name).replace(/^@/, '').toLowerCase()}`};
    contexts = [...contexts, c];
    return c;
  },
  context_rename: ({id, name}) => (contexts = contexts.map(c => c.id === id ? {...c, name: `@${String(name).replace(/^@/, '')}`} : c)),
  context_delete: ({id}) => (contexts = contexts.filter(c => c.id !== id)),
  pomodoro_state: () => pomodoro,
  pomodoro_pause: () => (pomodoro = {...pomodoro, status: 'paused', remainingMs: Math.max(0, (pomodoro.endsAt ?? 0) - Date.now()), endsAt: null}),
  pomodoro_resume: () => (pomodoro = {...pomodoro, status: 'running', endsAt: Date.now() + pomodoro.remainingMs}),
  pomodoro_reset: () => (pomodoro = {...pomodoro, phase: 'focus', status: 'idle', endsAt: null, remainingMs: 25 * 60 * 1000, plannedMs: 25 * 60 * 1000}),
  pomodoro_start: ({taskId}) => {
    const t = taskId ? tasks.get(Number(taskId)) : undefined;
    pomodoro = {...pomodoro, phase: 'focus', status: 'running', endsAt: Date.now() + 25 * 60 * 1000, remainingMs: 25 * 60 * 1000,
      plannedMs: 25 * 60 * 1000, task: t ? {id: t.id, seq: t.seq, title: t.title} : pomodoro.task};
    return pomodoro;
  },
  pomodoro_skip: () => pomodoro,
  pomodoro_link: () => pomodoro,
  capture_dismiss: () => undefined,
};

export function installMockBackend() {
  mockWindows('main');
  mockIPC((cmd, args) => {
    if (cmd.startsWith('plugin:')) return null;
    const handler = handlers[cmd];
    if (!handler) throw new Error(`The preview has no mock for ${cmd}`);
    const result = handler((args ?? {}) as Args);
    if (cmd.startsWith('pomodoro_')) void emit('pomodoro:state', pomodoro);
    return result;
  }, {shouldMockEvents: true});
}

/** ?open=new-task, ?open=settings:pomodoro, ?open=palette or ?open=project opens that overlay for a screenshot. */
export function openPreviewOverlay() {
  const open = new URLSearchParams(location.search).get('open');
  if (!open) return;
  const [what, tab] = open.split(':');
  const ui = useUi.getState();
  if (what === 'new-task') ui.openNewTask({status: 'todo'});
  if (what === 'settings') ui.openSettings((tab as Parameters<typeof ui.openSettings>[0]) ?? 'general');
  if (what === 'palette') ui.setPaletteOpen(true);
  if (what === 'project') ui.setProjectDialogOpen(true);
}
