import {Button} from '@/components/glaze/ui/button';
import {Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemLink, ItemTitle} from '@/components/glaze/ui/item';
import {Status} from '@/components/glaze/ui/status';
import {addDays, today} from '@/lib/domain/dates';
import {projectStats} from '@/lib/domain/selectors';
import {isClosed} from '@/lib/domain/status';
import type {Project, Task} from '@/lib/domain/types';
import {filterBoard, href, useUi} from '@/lib/store/ui';
import {TaskRow} from '@/app/task/task-row';
import type {Outcome} from './decision-card';

/** How many tasks the review sent each way. */
export type Tally = Record<Outcome, number>;

/** The weekly review's last step: what it did, what is due next, and projects that have no next action. */
export function WrapUp({tally, onFinish, projects, tasks}: {tally: Tally; onFinish: () => void; projects: Project[]; tasks: Task[]}) {
  const now = today();
  const soon = tasks.filter(t => t.dueDate && !isClosed(t.status) && t.dueDate <= addDays(now, 7))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const stats = projectStats(tasks);
  const stuck = projects.filter(p => p.completedAt === null && !stats.get(p.id)?.hasNextAction);

  const reviewed = Object.values(tally).reduce((a, b) => a + b, 0);
  const parts = [
    tally.todo && `${tally.todo} moved to Todo`,
    tally.backlog && `${tally.backlog} moved to backlog`,
    tally.done && `${tally.done} done`,
    tally.cancelled && `${tally.cancelled} cancelled`,
    tally.kept && `${tally.kept} kept`,
  ].filter(Boolean);
  const summary = reviewed ? `You reviewed ${reviewed} ${reviewed === 1 ? 'task' : 'tasks'}: ${parts.join(', ')}.` : 'Nothing needed a decision this week.';

  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
      <p className="type-body text-text-1">{summary}</p>
      <section aria-labelledby="due-soon" className="flex flex-col gap-2">
        <h2 id="due-soon" className="type-heading-sm">Due in the next 7 days</h2>
        {soon.length
          ? <ItemGroup aria-labelledby="due-soon">{soon.map(t => <TaskRow key={t.id} task={t} list="due-soon"/>)}</ItemGroup>
          : <p className="type-body-sm text-text-2">Nothing is due this week.</p>}
      </section>
      <section aria-labelledby="no-next-action" className="flex flex-col gap-2">
        <h2 id="no-next-action" className="type-heading-sm">Projects with no next action</h2>
        {stuck.length
          ? <ItemGroup aria-labelledby="no-next-action">{stuck.map(p => <Item key={p.id}>
            <ItemContent>
              <ItemTitle>
                <ItemLink href={href('board')} onClick={() => filterBoard('project', p.id)}>{p.name}</ItemLink>
              </ItemTitle>
              {p.outcome && <ItemDescription>{p.outcome}</ItemDescription>}
            </ItemContent>
            <Status status="warn" size="sm">No next action</Status>
            <ItemActions>
              <Button size="sm" variant="secondary" onClick={() => useUi.getState().openNewTask({projectId: p.id, status: 'todo'})}>Add next action</Button>
            </ItemActions>
          </Item>)}</ItemGroup>
          : <p className="type-body-sm text-text-2">Every active project has a task in Todo or In progress.</p>}
      </section>
      <div className="flex justify-end">
        <Button onClick={onFinish}>Finish review</Button>
      </div>
    </div>
  </div>;
}
