// Everything the UI changes goes through here: the store shows the change at once, Rust saves it, and a failure puts
// it back and says why. Changes that can be undone push their inverse onto one undo stack (⌘Z and toasts' Undo).

import {toast} from '@/components/glaze/ui/toast';
import {between} from '@/lib/domain/order';
import {sortColumn} from '@/lib/domain/selectors';
import {STATUSES, statusLabel, taskKey} from '@/lib/domain/status';
import type {Settings, Task, TaskPatch, TaskStatus} from '@/lib/domain/types';
import {commands, errorText} from '@/lib/tauri/commands';
import {getSettings, useData} from './data';
import {closeTask, useUi} from './ui';

type Undo = {label: string; run: () => Promise<unknown>};
const undoStack: Undo[] = [];

function pushUndo(label: string, run: () => Promise<unknown>) {
  undoStack.push({label, run});
  if (undoStack.length > 50) undoStack.shift();
}

export async function undoLast() {
  const last = undoStack.pop();
  if (!last) return;
  await attempt(last.run(), `Couldn't undo ${last.label}`);
}

async function attempt<T>(promise: Promise<T>, failure: string): Promise<T | undefined> {
  try {
    return await promise;
  } catch (error) {
    toast.fail(failure, {description: errorText(error)});
    return undefined;
  }
}

const task = (id: number): Task | undefined => useData.getState().tasks[id];

/** The tasks above and below a task in its column, so it can go back there. */
function neighbours(id: number, status: TaskStatus): [number | null, number | null] {
  const column = sortColumn(Object.values(useData.getState().tasks).filter(t => t.status === status), status);
  const index = column.findIndex(t => t.id === id);
  return [column[index - 1]?.id ?? null, column[index + 1]?.id ?? null];
}

/** Saves a change to a task. Status changes can be undone, back to the same place in the old column. */
export async function updateTask(id: number, patch: TaskPatch) {
  const before = task(id);
  if (!before) return;
  const {processed: _processed, reviewed: _reviewed, ...visible} = patch;
  const place = patch.status && patch.status !== before.status ? neighbours(id, before.status) : null;
  // A task that changes column lands on top of the new one, as Rust will put it.
  const top = place ? between(undefined, sortColumn(Object.values(useData.getState().tasks)
    .filter(t => t.status === patch.status), patch.status!)[0]?.sortOrder) : before.sortOrder;
  useData.getState().upsertTasks([{...before, ...visible, sortOrder: top}]);
  try {
    useData.getState().upsertTasks([await commands.updateTask(id, patch)]);
    if (place) {
      pushUndo(`the move to ${statusLabel[patch.status!]}`, () => moveTask(id, before.status, ...place, false));
    }
  } catch (error) {
    useData.getState().upsertTasks([before]);
    toast.fail(`Couldn't save ${taskKey(before.seq)}`, {description: errorText(error)});
  }
}

/** Drops a task between two neighbours, as a drag does. */
export async function moveTask(id: number, status: TaskStatus, prevId: number | null, nextId: number | null, undoable = true) {
  const before = task(id);
  if (!before) return;
  const tasks = useData.getState().tasks;
  const place = neighbours(id, before.status);
  const sortOrder = between(prevId ? tasks[prevId]?.sortOrder : undefined, nextId ? tasks[nextId]?.sortOrder : undefined);
  const now = Date.now();
  useData.getState().upsertTasks([{
    ...before,
    status,
    sortOrder,
    completedAt: status === 'done' ? (before.status === 'done' ? before.completedAt : now) : null,
    cancelledAt: status === 'cancelled' ? (before.status === 'cancelled' ? before.cancelledAt : now) : null,
  }]);
  try {
    useData.getState().upsertTasks(await commands.moveTask(id, status, prevId, nextId));
    if (undoable && (status !== before.status || place[0] !== prevId)) {
      pushUndo('the move', () => moveTask(id, before.status, ...place, false));
    }
  } catch (error) {
    useData.getState().upsertTasks([before]);
    toast.fail(`Couldn't move ${taskKey(before.seq)}`, {description: errorText(error)});
  }
}

export async function deleteTask(id: number) {
  const before = task(id);
  if (!before) return;
  if (useUi.getState().task === id) closeTask();
  useData.getState().removeTasks([id]);
  try {
    await commands.deleteTask(id);
  } catch (error) {
    useData.getState().upsertTasks([before]);
    toast.fail(`Couldn't delete ${taskKey(before.seq)}`, {description: errorText(error)});
    return;
  }
  const restore = async () => useData.getState().upsertTasks([await commands.restoreTask(id)]);
  pushUndo(`deleting ${taskKey(before.seq)}`, restore);
  toast(`Deleted ${taskKey(before.seq)}`, {
    description: before.title,
    action: {label: 'Undo', onClick: () => void attempt(restore(), `Couldn't restore ${taskKey(before.seq)}`)},
  });
}

export async function updateSettings(patch: Partial<Settings>) {
  const before = useData.getState().settings;
  if (before) useData.getState().setSettings({...before, ...patch});
  try {
    useData.getState().setSettings(await commands.updateSettings(patch));
    return true;
  } catch (error) {
    if (before) useData.getState().setSettings(before);
    toast.fail("Couldn't save the setting", {description: errorText(error)});
    return false;
  }
}

/** Shows or hides a board column. The last column shown stays, so the board is never empty. */
export function setColumnVisible(status: TaskStatus, visible: boolean) {
  const current = getSettings().visibleColumns;
  const next = visible ? [...current, status] : current.filter(s => s !== status);
  if (next.length) void updateSettings({visibleColumns: STATUSES.filter(s => next.includes(s))});
}

export async function createProject(name: string, outcome = '') {
  return attempt(commands.createProject(name, outcome), "Couldn't create the project");
}

export async function updateProject(id: number, patch: {name?: string; outcome?: string; completed?: boolean}) {
  const projects = await attempt(commands.updateProject(id, patch), "Couldn't save the project");
  if (projects) useData.getState().setProjects(projects);
}

export async function deleteProject(id: number) {
  const project = useData.getState().projects.find(p => p.id === id);
  const projects = await attempt(commands.deleteProject(id), "Couldn't delete the project");
  if (!projects || !project) return;
  useData.getState().setProjects(projects);
  const restore = async () => useData.getState().setProjects(await commands.restoreProject(id));
  pushUndo(`deleting ${project.name}`, restore);
  toast(`Deleted ${project.name}`, {action: {label: 'Undo', onClick: () => void attempt(restore(), "Couldn't restore the project")}});
}

export async function createContext(name: string) {
  const context = await attempt(commands.createContext(name), "Couldn't create the context");
  if (context) {
    const contexts = useData.getState().contexts.filter(c => c.id !== context.id);
    useData.getState().setContexts([...contexts, context].sort((a, b) => a.name.localeCompare(b.name)));
  }
  return context;
}

export async function renameContext(id: number, name: string) {
  const contexts = await attempt(commands.renameContext(id, name), "Couldn't rename the context");
  if (contexts) useData.getState().setContexts(contexts);
  return Boolean(contexts);
}

export async function deleteContext(id: number) {
  const context = useData.getState().contexts.find(c => c.id === id);
  const contexts = await attempt(commands.deleteContext(id), "Couldn't delete the context");
  if (!contexts || !context) return;
  useData.getState().setContexts(contexts);
  const restore = async () => useData.getState().setContexts(await commands.restoreContext(id));
  pushUndo(`deleting ${context.name}`, restore);
  toast(`Deleted ${context.name}`, {action: {label: 'Undo', onClick: () => void attempt(restore(), "Couldn't restore the context")}});
}

export const timer = {
  start: (taskId: number | null = null) => attempt(commands.pomodoroStart(taskId), "Couldn't start the timer"),
  pause: () => attempt(commands.pomodoroPause(), "Couldn't pause the timer"),
  resume: () => attempt(commands.pomodoroResume(), "Couldn't resume the timer"),
  skip: () => attempt(commands.pomodoroSkip(), "Couldn't skip ahead"),
  reset: () => attempt(commands.pomodoroReset(), "Couldn't stop the session"),
};

/** Start, pause or resume focus on a task, whichever fits what the timer is doing now. */
export function toggleFocus(taskId: number) {
  const pomodoro = useData.getState().pomodoro;
  const onThis = pomodoro?.task?.id === taskId && pomodoro.phase === 'focus';
  if (onThis && pomodoro.status === 'running') return timer.pause();
  if (onThis && pomodoro.status === 'paused') return timer.resume();
  return timer.start(taskId);
}

export async function copyTaskKey(id: number) {
  const found = task(id);
  if (!found) return;
  await navigator.clipboard.writeText(taskKey(found.seq));
  toast(`Copied ${taskKey(found.seq)}`);
}
