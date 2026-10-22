// The shapes Rust sends. Times are epoch milliseconds; dueDate is a local calendar day, YYYY-MM-DD.

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

/** 0 none, 1 urgent, 2 high, 3 medium, 4 low, as in Linear. */
export type Priority = 0 | 1 | 2 | 3 | 4;

export interface Task {
  id: number;
  seq: number;
  title: string;
  description: string;
  status: TaskStatus;
  sortOrder: number;
  priority: Priority;
  projectId: number | null;
  contextIds: number[];
  dueDate: string | null;
  createdAt: number;
  updatedAt: number;
  activityAt: number;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  processedAt: number | null;
  reviewedAt: number | null;
  pomodorosCompleted: number;
}

export interface NewTask {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  projectId?: number | null;
  contextIds?: number[];
  dueDate?: string | null;
  /** False for quick capture: the task waits in the inbox. */
  processed?: boolean;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  projectId?: number | null;
  contextIds?: number[];
  dueDate?: string | null;
  processed?: boolean;
  reviewed?: boolean;
}

export interface Project {
  id: number;
  name: string;
  outcome: string;
  createdAt: number;
  completedAt: number | null;
}

export interface Context {
  id: number;
  name: string;
}

export interface Session {
  id: number;
  taskId: number | null;
  phase: Phase;
  plannedMs: number;
  startedAt: number;
  endedAt: number | null;
  completed: boolean;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  visibleColumns: TaskStatus[];
  showEmptyColumns: boolean;
  completedDays: number | null;
  wipLimit: number;
  stalledDays: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  moveToInProgress: boolean;
  soundEnabled: boolean;
  showTimeInMenuBar: boolean;
  theme: Theme;
  captureShortcut: string;
  weekStartsOn: 0 | 1;
  lastReviewAt: number | null;
  sidebarCollapsed: boolean;
}

export type Phase = 'focus' | 'short_break' | 'long_break';
export type TimerStatus = 'idle' | 'running' | 'paused';

export interface LinkedTask {
  id: number;
  seq: number;
  title: string;
}

export interface PomodoroSnapshot {
  phase: Phase;
  status: TimerStatus;
  endsAt: number | null;
  remainingMs: number;
  plannedMs: number;
  completedInCycle: number;
  longBreakEvery: number;
  task: LinkedTask | null;
}

export interface TasksChanged {
  upserted: Task[];
  deleted: number[];
}

export interface Bootstrap {
  tasks: Task[];
  projects: Project[];
  contexts: Context[];
  settings: Settings;
  pomodoro: PomodoroSnapshot;
}
