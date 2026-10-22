import type {Announcements, ScreenReaderInstructions} from '@dnd-kit/core';
import {statusLabel, taskKey} from '@/lib/domain/status';
import type {TaskStatus} from '@/lib/domain/types';
import {useData} from '@/lib/store/data';

export type Columns = Record<TaskStatus, number[]>;

export const columnId = (status: TaskStatus) => `column:${status}`;

/** The column an id belongs to: a column's own droppable id, or the column holding that task. */
export function containerOf(id: string | number, columns: Columns): TaskStatus | null {
  if (typeof id === 'string' && id.startsWith('column:')) return id.slice(7) as TaskStatus;
  for (const [status, ids] of Object.entries(columns)) if (ids.includes(Number(id))) return status as TaskStatus;
  return null;
}

/** Set while a card is carried by keyboard: the arrow keys belong to the drag then. */
export const keyboardDrag = {active: false};

/** The click that ends a pointer drag lands on the card's link; this lets the card ignore it. */
export const cardDragged = {
  at: 0,
  mark() {
    this.at = Date.now();
  },
  recently() {
    return Date.now() - this.at < 250;
  },
};

export const instructions: ScreenReaderInstructions = {
  draggable: 'Press Enter to open the task. To move it, press Space to pick it up, use the arrow keys to choose a place, then Space to drop it or Escape to put it back.',
};

/** What a screen reader hears while a card moves, read from the columns as they are during the drag. */
export function announcements(columns: () => Columns): Announcements {
  const name = (id: string | number) => {
    const task = useData.getState().tasks[Number(id)];
    return task ? `${taskKey(task.seq)}, ${task.title}` : 'The task';
  };
  const place = (id: string | number) => {
    const all = columns();
    const status = containerOf(id, all);
    if (!status) return '';
    const index = all[status].indexOf(Number(id));
    return `${statusLabel[status]}, position ${index + 1} of ${all[status].length}`;
  };
  return {
    onDragStart: ({active}) => `Picked up ${name(active.id)}. ${place(active.id)}.`,
    onDragOver: ({active, over}) => (over ? `${place(active.id)}.` : `${name(active.id)} is outside the columns.`),
    onDragEnd: ({active, over}) => (over ? `Dropped in ${place(active.id)}.` : `${name(active.id)} was put back.`),
    onDragCancel: ({active}) => `Move cancelled. ${name(active.id)} is back where it was.`,
  };
}
