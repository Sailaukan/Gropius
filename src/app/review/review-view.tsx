import {useMemo, useState} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Step, StepDescription, StepIndicator, StepSeparator, Steps, StepText, StepTitle, StepTrigger} from '@/components/glaze/ui/steps';
import {toast} from '@/components/glaze/ui/toast';
import {isStalled, needsBacklogReview, sortColumn} from '@/lib/domain/selectors';
import {updateSettings} from '@/lib/store/actions';
import {useData, useSettings} from '@/lib/store/data';
import {navigate} from '@/lib/store/ui';
import {ViewHeader} from '@/app/shell/view-header';
import type {Outcome} from './decision-card';
import {QueueDone, ReviewProcessor} from './review-processor';
import {WrapUp, type Tally} from './wrap-up';

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
