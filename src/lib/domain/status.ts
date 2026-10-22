import type {StatusValue} from '@/components/glaze/ui/status';
import type {TaskStatus} from './types';

/** The columns, left to right. */
export const STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done', 'cancelled'];

export const statusLabel: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

/**
 * How each column reads in Glaze's Status: work on the way stays ink and only Done takes a colour. Cancelled is idle
 * with its own word, because the fail mark would call a dropped task a failure.
 */
export const statusTone: Record<TaskStatus, StatusValue> = {
  backlog: 'idle',
  todo: 'queued',
  in_progress: 'running',
  done: 'ok',
  cancelled: 'idle',
};

/** Done and Cancelled are closed: they sort by when they closed and leave the board after a while. */
export const isClosed = (status: TaskStatus) => status === 'done' || status === 'cancelled';

export const closedAt = (task: {status: TaskStatus; completedAt: number | null; cancelledAt: number | null}) =>
  task.status === 'done' ? task.completedAt : task.status === 'cancelled' ? task.cancelledAt : null;

/** The display ID, as in Linear. */
export const taskKey = (seq: number) => `GRP-${seq}`;
