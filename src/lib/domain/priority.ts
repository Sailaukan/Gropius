import type {Priority} from './types';

/** The order the menus list them in: none first, then most urgent down. */
export const PRIORITIES: Priority[] = [0, 1, 2, 3, 4];

export const priorityLabel: Record<Priority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

/** Sort key: urgent first, no priority last. */
export const priorityRank = (priority: Priority) => (priority === 0 ? 5 : priority);
