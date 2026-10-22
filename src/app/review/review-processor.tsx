import {useEffect, useMemo, useRef, useState} from 'react';
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle} from '@/components/glaze/ui/empty-state';
import {Item, ItemContent, ItemGroup, ItemLink, ItemTitle} from '@/components/glaze/ui/item';
import {Status} from '@/components/glaze/ui/status';
import type {Task} from '@/lib/domain/types';
import {updateTask} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';
import {href, useUi} from '@/lib/store/ui';
import {DecisionCard, type Decision, type Outcome, type QueueKind} from './decision-card';

const outcomeWord: Record<Outcome, string> = {
  todo: 'Moved to Todo',
  backlog: 'Moved to backlog',
  kept: 'Kept',
  done: 'Done',
  cancelled: 'Cancelled',
};

interface ReviewProcessorProps {
  kind: QueueKind;
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
