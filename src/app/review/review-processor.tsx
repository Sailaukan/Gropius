import {useEffect, useMemo, useRef, useState} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardMeta, CardTitle} from '@/components/glaze/ui/card';
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle} from '@/components/glaze/ui/empty-state';
import {Item, ItemContent, ItemGroup, ItemLink, ItemTitle} from '@/components/glaze/ui/item';
import {Status} from '@/components/glaze/ui/status';
import {daysAgo} from '@/lib/domain/dates';
import {statusLabel, taskKey} from '@/lib/domain/status';
import type {Task, TaskPatch} from '@/lib/domain/types';
import {updateTask} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';
import {href, useUi} from '@/lib/store/ui';
import {ContextsPicker, DuePicker, PriorityPicker, ProjectPicker} from '@/app/task/property-pills';

export type Outcome = 'todo' | 'backlog' | 'kept' | 'done' | 'cancelled';

interface Decision {
  outcome: Outcome;
  label: string;
  patch: TaskPatch;
  primary?: boolean;
}

/** The choices for each queue, the lead last: GTD's "what is the next action?" asked one task at a time. */
const DECISIONS: Record<'inbox' | 'backlog' | 'stalled', Decision[]> = {
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

const outcomeWord: Record<Outcome, string> = {
  todo: 'Moved to Todo',
  backlog: 'Moved to backlog',
  kept: 'Kept',
  done: 'Done',
  cancelled: 'Cancelled',
};

interface ReviewProcessorProps {
  kind: 'inbox' | 'backlog' | 'stalled';
  /** The tasks to go through. New ones that join while the review is open are added at the end. */
  queue: Task[];
  onDecision?: (outcome: Outcome) => void;
  /** What shows once every task has a decision. */
  complete: React.ReactNode;
}

/** A queue on the left and one task at a time on the right, each ending in a decision. */
export function ReviewProcessor({kind, queue, onDecision, complete}: ReviewProcessorProps) {
  const tasks = useData(s => s.tasks);
  const [ids, setIds] = useState(() => queue.map(t => t.id));
  const [decided, setDecided] = useState<Record<number, Outcome>>({});
  const [currentId, setCurrentId] = useState<number | null>(queue[0]?.id ?? null);
  const view = useUi(s => s.view);
  const opened = useUi(s => s.task);

  // A row opens its task beside the review; the decision card follows it.
  useEffect(() => {
    if (opened !== null) setCurrentId(opened);
  }, [opened]);

  // A task captured while the review is open joins the end of the queue.
  useEffect(() => {
    setIds(prev => {
      const extra = queue.map(t => t.id).filter(id => !prev.includes(id));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }, [queue]);

  const rows = useMemo(() => ids.map(id => tasks[id]).filter(Boolean) as Task[], [ids, tasks]);
  const pending = rows.filter(t => !decided[t.id]);
  const current = rows.find(t => t.id === currentId && !decided[t.id]) ?? pending[0];
  const position = current ? rows.indexOf(current) + 1 : rows.length;

  // After a decision the next card takes focus on its lead action, so the keyboard keeps its place in the queue.
  const focusNext = useRef(false);
  const decide = (task: Task, decision: Decision) => {
    focusNext.current = true;
    void updateTask(task.id, {...decision.patch, processed: true, reviewed: true});
    setDecided(prev => ({...prev, [task.id]: decision.outcome}));
    onDecision?.(decision.outcome);
    const next = pending.find(t => t.id !== task.id && rows.indexOf(t) > rows.indexOf(task)) ?? pending.find(t => t.id !== task.id);
    setCurrentId(next?.id ?? null);
  };

  // The queue gives way to the card when the view is narrow: the card's footer needs the room, and its meta still
  // says how far along the queue is.
  return <div className="@container/review flex min-h-0 flex-1 gap-6 px-6 py-6">
    <div className="min-h-0 w-80 shrink-0 overflow-y-auto @max-3xl/review:hidden">
      <ItemGroup aria-label="Tasks to review">
        {rows.map(task => <Item key={task.id} size="sm" selected={current?.id === task.id}>
          <ItemContent>
            <ItemTitle>
              <ItemLink href={href(view, task.id)} aria-current={current?.id === task.id ? 'true' : undefined}>
                {task.title}
              </ItemLink>
            </ItemTitle>
          </ItemContent>
          {decided[task.id] && <span className="relative shrink-0">
            <Status status={decided[task.id] === 'cancelled' ? 'idle' : 'ok'} size="sm">{outcomeWord[decided[task.id]]}</Status>
          </span>}
        </Item>)}
      </ItemGroup>
    </div>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      {current
        ? <DecisionCard key={current.id} task={current} kind={kind} meta={`${position} of ${rows.length}`} onDecide={d => decide(current, d)} focusNext={focusNext}/>
        : complete}
    </div>
  </div>;
}

function DecisionCard({task, kind, meta, onDecide, focusNext}: {
  task: Task;
  kind: ReviewProcessorProps['kind'];
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

/** The finished state of a queue, with the one way forward. */
export function QueueDone({title, description, action}: {title: string; description: React.ReactNode; action?: React.ReactNode}) {
  return <Empty>
    <EmptyHeader>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action && <EmptyContent>{action}</EmptyContent>}
  </Empty>;
}
