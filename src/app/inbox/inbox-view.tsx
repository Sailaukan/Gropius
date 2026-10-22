import {useMemo} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Kbd} from '@/components/glaze/ui/kbd';
import {acceleratorKeys} from '@/lib/domain/accelerator';
import {isInbox, sortColumn} from '@/lib/domain/selectors';
import {useData, useSettings} from '@/lib/store/data';
import {useUi} from '@/lib/store/ui';
import {QueueDone, ReviewProcessor} from '@/app/review/review-processor';
import {ViewHeader} from '@/app/shell/view-header';

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
