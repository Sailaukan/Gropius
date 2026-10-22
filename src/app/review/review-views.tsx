import {useMemo, useState} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemLink, ItemTitle} from '@/components/glaze/ui/item';
import {Status} from '@/components/glaze/ui/status';
import {Step, StepDescription, StepIndicator, StepSeparator, Steps, StepText, StepTitle, StepTrigger} from '@/components/glaze/ui/steps';
import {toast} from '@/components/glaze/ui/toast';
import {addDays, today} from '@/lib/domain/dates';
import {isInbox, isStalled, needsBacklogReview, projectStats, sortColumn} from '@/lib/domain/selectors';
import {acceleratorKeys} from '@/lib/domain/accelerator';
import {isClosed} from '@/lib/domain/status';
import type {Project, Task} from '@/lib/domain/types';
import {updateSettings} from '@/lib/store/actions';
import {useData, useSettings} from '@/lib/store/data';
import {href, navigate, NO_FILTERS, useUi} from '@/lib/store/ui';
import {Kbd} from '@/components/glaze/ui/kbd';
import {ViewHeader} from '@/app/shell/view-header';
import {TaskRow} from '@/app/task/task-row';
import {QueueDone, ReviewProcessor, type Outcome} from './review-processor';

/** The GTD inbox: everything captured and not yet decided on, one task at a time. */
export function InboxView() {
  const tasks = useData(s => s.tasks);
  const {captureShortcut} = useSettings();
  const inbox = useMemo(() => sortColumn(Object.values(tasks).filter(isInbox), 'backlog'), [tasks]);

  return <>
    <ViewHeader title="Inbox" actions={
      <Button size="sm" variant="secondary" onClick={() => useUi.getState().openNewTask({status: 'backlog', processed: false})}>Capture task</Button>
    }/>
    {inbox.length
      ? <ReviewProcessor kind="inbox" queue={inbox} complete={null}/>
      : <div className="flex flex-1 items-center justify-center p-6">
        <QueueDone
          title="Inbox is empty"
          description={<>Everything you captured has a place. Capture from any app with <Kbd keys={acceleratorKeys(captureShortcut)}/>.</>}
        />
      </div>}
    {inbox.length > 0 && <p className="shrink-0 border-t border-line-faint px-6 py-2 type-caption text-text-2">
      Capture from any app with <Kbd keys={acceleratorKeys(captureShortcut)}/>. Each task here needs one decision: what happens next.
    </p>}
  </>;
}

type Tally = Record<Outcome, number>;
const NO_TALLY: Tally = {todo: 0, backlog: 0, kept: 0, done: 0, cancelled: 0};

/** The weekly review: clear the backlog, unstick what stalled, then look at the week ahead. */
export function ReviewView() {
  const tasks = useData(s => s.tasks);
  const projects = useData(s => s.projects);
  const settings = useSettings();
  const [step, setStep] = useState(1);
  const [tally, setTally] = useState<Tally>(NO_TALLY);
  const count = (outcome: Outcome) => setTally(t => ({...t, [outcome]: t[outcome] + 1}));

  const all = useMemo(() => Object.values(tasks), [tasks]);
  const backlog = useMemo(() => sortColumn(all.filter(t => needsBacklogReview(t)), 'backlog'), [all]);
  const stalled = useMemo(() => all.filter(t => isStalled(t, settings.stalledDays))
    .sort((a, b) => a.activityAt - b.activityAt), [all, settings.stalledDays]);

  const finish = async () => {
    if (await updateSettings({lastReviewAt: Date.now()})) {
      const reviewed = Object.values(tally).reduce((a, b) => a + b, 0);
      toast.success('Weekly review done', {description: reviewed ? `${reviewed} tasks reviewed.` : undefined});
      navigate('board');
    }
  };

  return <>
    <ViewHeader title="Weekly review"/>
    <div className="shrink-0 border-b border-line-faint px-6 py-3">
      <Steps value={step} onValueChange={setStep} aria-label="Weekly review" size="sm">
        <Step step={1}>
          <StepTrigger><StepIndicator/><StepText><StepTitle>Backlog</StepTitle><StepDescription>{backlog.length} to review</StepDescription></StepText></StepTrigger>
          <StepSeparator/>
        </Step>
        <Step step={2}>
          <StepTrigger><StepIndicator/><StepText><StepTitle>Stalled</StepTitle><StepDescription>{stalled.length} not moving</StepDescription></StepText></StepTrigger>
          <StepSeparator/>
        </Step>
        <Step step={3}>
          <StepTrigger><StepIndicator/><StepText><StepTitle>Wrap up</StepTitle><StepDescription>The week ahead</StepDescription></StepText></StepTrigger>
        </Step>
      </Steps>
    </div>
    {step === 1 && <ReviewProcessor
      key="backlog"
      kind="backlog"
      queue={backlog}
      onDecision={count}
      complete={<QueueDone
        title="Backlog reviewed"
        description="Every task in the backlog has a decision."
        action={<Button size="sm" onClick={() => setStep(2)}>Continue to stalled tasks</Button>}
      />}
    />}
    {step === 2 && <ReviewProcessor
      key="stalled"
      kind="stalled"
      queue={stalled}
      onDecision={count}
      complete={<QueueDone
        title={stalled.length ? 'Stalled tasks reviewed' : 'Nothing has stalled'}
        description={`Todo and In progress tasks idle for ${settings.stalledDays} days show up here.`}
        action={<Button size="sm" onClick={() => setStep(3)}>Continue to wrap up</Button>}
      />}
    />}
    {step === 3 && <WrapUp tally={tally} onFinish={finish} projects={projects} tasks={all}/>}
  </>;
}

function WrapUp({tally, onFinish, projects, tasks}: {tally: Tally; onFinish: () => void; projects: Project[]; tasks: Task[]}) {
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
                <ItemLink href={href('board')} onClick={() => useUi.getState().setFilters({...NO_FILTERS, project: [String(p.id)]})}>{p.name}</ItemLink>
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
