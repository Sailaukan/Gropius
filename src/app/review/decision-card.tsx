import {useEffect, useRef} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardMeta, CardTitle} from '@/components/glaze/ui/card';
import {daysAgo} from '@/lib/domain/dates';
import {statusLabel, taskKey} from '@/lib/domain/status';
import type {Task, TaskPatch} from '@/lib/domain/types';
import {updateTask} from '@/lib/store/actions';
import {href, useUi} from '@/lib/store/ui';
import {ContextsPicker, DuePicker, PriorityPicker, ProjectPicker} from '@/app/task/property-pills';

/** The queues a review goes through: new captures, the backlog, and work that stalled. */
export type QueueKind = 'inbox' | 'backlog' | 'stalled';

export type Outcome = 'todo' | 'backlog' | 'kept' | 'done' | 'cancelled';

export interface Decision {
  outcome: Outcome;
  label: string;
  patch: TaskPatch;
  primary?: boolean;
}

/** The choices for each queue, the lead last: GTD's "what is the next action?" asked one task at a time. */
const DECISIONS: Record<QueueKind, Decision[]> = {
  inbox: [
    {outcome: 'cancelled', label: 'Cancel task', patch: {status: 'cancelled'}},
    {outcome: 'done', label: 'Mark done', patch: {status: 'done'}},
    {outcome: 'kept', label: 'Keep in backlog', patch: {}},
    {outcome: 'todo', label: 'Move to Todo', patch: {status: 'todo'}, primary: true},
  ],
  backlog: [
    {outcome: 'cancelled', label: 'Cancel task', patch: {status: 'cancelled'}},
    {outcome: 'kept', label: 'Keep in backlog', patch: {}},
    {outcome: 'todo', label: 'Move to Todo', patch: {status: 'todo'}, primary: true},
  ],
  stalled: [
    {outcome: 'cancelled', label: 'Cancel task', patch: {status: 'cancelled'}},
    {outcome: 'backlog', label: 'Move to backlog', patch: {status: 'backlog'}},
    {outcome: 'done', label: 'Mark done', patch: {status: 'done'}},
    {outcome: 'kept', label: 'Keep going', patch: {}, primary: true},
  ],
};

/** One task from the queue: what it is, its properties to set on the spot, and the decisions it can take. */
export function DecisionCard({task, kind, meta, onDecide, focusNext}: {
  task: Task;
  kind: QueueKind;
  meta: string;
  onDecide: (d: Decision) => void;
  focusNext: React.RefObject<boolean>;
}) {
  const view = useUi(s => s.view);
  const lead = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    lead.current?.focus();
  }, [focusNext]);
  const age = daysAgo(task.createdAt);
  const captured = age === 0 ? 'captured today' : age === 1 ? 'captured yesterday' : `captured ${age} days ago`;
  const idle = daysAgo(task.activityAt);
  const context = kind === 'stalled' ? `no activity for ${idle} days` : captured;

  return <Card role="group" aria-labelledby={`review-${task.id}`} className="max-w-(--overlay-lg)">
    <CardHeader>
      <CardTitle id={`review-${task.id}`}>{task.title}</CardTitle>
      <CardDescription>
        <span className="mono">{taskKey(task.seq)}</span> · {statusLabel[task.status]} · {context}
      </CardDescription>
      <CardAction>
        <Button variant="ghost" size="sm" render={<a href={href(view, task.id)}/>} nativeButton={false}>Open details</Button>
      </CardAction>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      {task.description && <p className="line-clamp-6 type-body-sm whitespace-pre-wrap text-text-2">{task.description}</p>}
      <div role="group" aria-label="Task properties" className="flex flex-wrap items-center gap-2">
        <PriorityPicker value={task.priority} onChange={priority => void updateTask(task.id, {priority})}/>
        <ProjectPicker value={task.projectId} onChange={projectId => void updateTask(task.id, {projectId})}/>
        <ContextsPicker value={task.contextIds} onChange={contextIds => void updateTask(task.id, {contextIds})}/>
        <DuePicker value={task.dueDate} onChange={dueDate => void updateTask(task.id, {dueDate})}/>
      </div>
      {kind === 'inbox' && <p className="type-caption text-text-2">Takes under two minutes? Do it now, then mark it done.</p>}
    </CardContent>
    <CardFooter>
      <CardMeta>{meta}</CardMeta>
      {DECISIONS[kind].map(d => <Button key={d.outcome} ref={d.primary ? lead : undefined} size="sm" variant={d.primary ? 'primary' : 'secondary'} onClick={() => onDecide(d)}>
        {d.label}
      </Button>)}
    </CardFooter>
  </Card>;
}
