import {useEffect, useState} from 'react';
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/glaze/ui/collapsible';
import {SheetField, SheetSection} from '@/components/glaze/ui/sheet';
import {Status} from '@/components/glaze/ui/status';
import type {Session, Task} from '@/lib/domain/types';
import {commands} from '@/lib/tauri/commands';

/** How many focus sessions the task has had, and each one. */
export function FocusSection({task}: {task: Task}) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  useEffect(() => {
    let current = true;
    void commands.taskSessions(task.id).then(list => { if (current) setSessions(list); });
    return () => { current = false; };
  }, [task.id, task.pomodorosCompleted]);

  const minutes = Math.round((sessions ?? []).filter(s => s.completed).reduce((sum, s) => sum + s.plannedMs, 0) / 60_000);
  const total = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
  return <div className="flex flex-col gap-2">
    <SheetSection title="Focus">
      <SheetField label="Pomodoros">
        {task.pomodorosCompleted === 0 ? 'None yet' : `${task.pomodorosCompleted} completed, ${total}`}
      </SheetField>
    </SheetSection>
    {sessions && sessions.length > 0 && <Collapsible>
      <CollapsibleTrigger size="sm" summary={`${sessions.length}`}>Session history</CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="flex flex-col pt-2">
          {sessions.map(s => <li key={s.id} className="rule-row flex min-h-(--row) items-center gap-3 py-1">
            <span className="type-body-sm text-text-1">{new Date(s.startedAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}</span>
            <span className="type-caption text-text-2">{Math.round(s.plannedMs / 60_000)} min</span>
            <span className="ms-auto">{s.completed
              ? <Status status="ok" size="sm">Completed</Status>
              : <Status status="idle" size="sm">Stopped early</Status>}</span>
          </li>)}
        </ul>
      </CollapsibleContent>
    </Collapsible>}
  </div>;
}
