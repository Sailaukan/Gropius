import {useMemo} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/glaze/ui/collapsible';
import {Empty, EmptyDescription, EmptyHeader, EmptyTitle} from '@/components/glaze/ui/empty-state';
import {ItemGroup} from '@/components/glaze/ui/item';
import {today} from '@/lib/domain/dates';
import {todayBuckets} from '@/lib/domain/selectors';
import {sortColumn} from '@/lib/domain/selectors';
import type {Task} from '@/lib/domain/types';
import {useData} from '@/lib/store/data';
import {useUi} from '@/lib/store/ui';
import {ViewHeader} from '@/app/shell/view-header';
import {TaskRow} from '@/app/task/task-row';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** What needs doing today: anything overdue, what is due, and what is already under way. */
export function TodayView() {
  const tasks = useData(s => s.tasks);
  const {overdue, dueToday, doneToday, inProgress} = useMemo(() => {
    const all = Object.values(tasks);
    const buckets = todayBuckets(all);
    const dated = new Set([...buckets.overdue, ...buckets.dueToday].map(t => t.id));
    const inProgress = sortColumn(all.filter(t => t.status === 'in_progress' && !dated.has(t.id)), 'in_progress');
    return {...buckets, inProgress};
  }, [tasks]);

  const parts = [
    overdue.length ? plural(overdue.length, 'task overdue', 'tasks overdue') : '',
    dueToday.length ? `${dueToday.length} due today` : '',
    inProgress.length ? `${inProgress.length} in progress` : '',
  ].filter(Boolean);
  const summary = parts.length ? `${parts.join(', ')}.` : 'Nothing is due today.';

  return <>
    <ViewHeader title="Today" actions={
      <Button size="sm" onClick={() => useUi.getState().openNewTask({dueDate: today(), status: 'todo'})}>New task</Button>
    }/>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
        <p className="type-body text-text-2">{summary}</p>
        {overdue.length > 0 && <TaskSection id="overdue" title="Overdue" tasks={overdue}/>}
        {dueToday.length > 0 && <TaskSection id="due-today" title="Due today" tasks={dueToday} showDue={false}/>}
        {inProgress.length > 0 && <TaskSection id="in-progress" title="In progress" tasks={inProgress}/>}
        {!overdue.length && !dueToday.length && !inProgress.length && <Empty>
          <EmptyHeader>
            <EmptyTitle>Nothing due today</EmptyTitle>
            <EmptyDescription>Give a task a due date and it shows up here on the day.</EmptyDescription>
          </EmptyHeader>
        </Empty>}
        {doneToday.length > 0 && <Collapsible>
          <CollapsibleTrigger summary={String(doneToday.length)}>Done today</CollapsibleTrigger>
          <CollapsibleContent>
            <ItemGroup aria-label="Done today" className="mt-2">
              {doneToday.map(t => <TaskRow key={t.id} task={t} list="done-today"/>)}
            </ItemGroup>
          </CollapsibleContent>
        </Collapsible>}
      </div>
    </div>
  </>;
}

function TaskSection({id, title, tasks, showDue = true}: {id: string; title: string; tasks: Task[]; showDue?: boolean}) {
  return <section aria-labelledby={id} className="flex flex-col gap-2">
    <h2 id={id} className="type-heading-sm">{title}</h2>
    <ItemGroup aria-labelledby={id}>
      {tasks.map(t => <TaskRow key={t.id} task={t} list={id} showDue={showDue}/>)}
    </ItemGroup>
  </section>;
}
