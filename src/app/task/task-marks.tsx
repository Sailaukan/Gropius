import {Calendar, Icon, PriorityHigh, PriorityLow, PriorityMedium, PriorityUrgent, Subtract, type GlazeIcon} from '@/components/glaze/icon';
import {Badge} from '@/components/glaze/ui/badge';
import {Status} from '@/components/glaze/ui/status';
import {dueLabel, dueState} from '@/lib/domain/dates';
import {priorityLabel} from '@/lib/domain/priority';
import {isClosed, statusLabel, statusTone} from '@/lib/domain/status';
import type {Priority, Task, TaskStatus} from '@/lib/domain/types';
import {useData} from '@/lib/store/data';

export const priorityIcon: Record<Priority, GlazeIcon> = {
  0: Subtract,
  1: PriorityUrgent,
  2: PriorityHigh,
  3: PriorityMedium,
  4: PriorityLow,
};

/** The priority glyph, named for a screen reader. No priority draws nothing. */
export function PriorityMark({priority}: {priority: Priority}) {
  if (priority === 0) return null;
  return <Icon icon={priorityIcon[priority]} size={14} label={`${priorityLabel[priority]} priority`} className={priority === 1 ? 'text-text-1' : 'text-text-2'}/>;
}

/**
 * The status as Glaze says it: a glyph and a word. The In progress arc only turns for the task being focused on,
 * so a column of work in progress does not spin.
 */
export function TaskStatusMark({status, size = 'default', live = false}: {status: TaskStatus; size?: 'default' | 'sm'; live?: boolean}) {
  const mark = <Status status={statusTone[status]} size={size}>{statusLabel[status]}</Status>;
  return status === 'in_progress' && !live ? <span data-force-reduced-motion="">{mark}</span> : mark;
}

/**
 * When an open task is due. A missed date is a failure and today is a risk, so they take Glaze's status colours with a
 * word; a later date is a plain caption.
 */
export function DueMark({task}: {task: Task}) {
  if (!task.dueDate || isClosed(task.status)) return null;
  const state = dueState(task.dueDate);
  const label = dueLabel(task.dueDate);
  if (state === 'overdue') return <Status status="fail" size="sm">{label}</Status>;
  if (state === 'today') return <Status status="warn" size="sm">{label}</Status>;
  return <span className="inline-flex items-center gap-1 type-caption text-text-2">
    <Icon icon={Calendar} size={12}/>
    <span><span className="sr-only">Due </span>{label}</span>
  </span>;
}

/** The project and contexts, as neutral tags: colour stays for status. */
export function TaskTags({task}: {task: Task}) {
  const project = useData(s => (task.projectId ? s.projects.find(p => p.id === task.projectId) : undefined));
  const contexts = useData(s => s.contexts);
  const names = task.contextIds.map(id => contexts.find(c => c.id === id)?.name).filter(Boolean) as string[];
  if (!project && !names.length) return null;
  return <>
    {project && <Badge variant="outline" size="sm"><span className="sr-only">Project </span>{project.name}</Badge>}
    {names.map(name => <Badge key={name} size="sm">{name}</Badge>)}
  </>;
}
