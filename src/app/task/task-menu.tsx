import {More} from '@/components/glaze/icon';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/glaze/ui/dropdown-menu';
import {addDays, today} from '@/lib/domain/dates';
import {PRIORITIES, priorityLabel} from '@/lib/domain/priority';
import {STATUSES, statusLabel, taskKey} from '@/lib/domain/status';
import type {Priority, Task, TaskStatus} from '@/lib/domain/types';
import {copyTaskKey, deleteTask, toggleFocus, updateTask} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';
import {href, useUi} from '@/lib/store/ui';
import {Icon} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';

/** "Start focus", "Pause focus" or "Resume focus", from what the timer is doing with this task. */
export function useFocusVerb(taskId: number): string {
  return useData(s => {
    const p = s.pomodoro;
    if (p?.task?.id !== taskId || p.phase !== 'focus') return 'Start focus';
    return p.status === 'running' ? 'Pause focus' : p.status === 'paused' ? 'Resume focus' : 'Start focus';
  });
}

/** Every action on a task, for its More button and the right-click menu. Delete comes last, after a rule. */
export function TaskMenuItems({task}: {task: Task}) {
  const view = useUi(s => s.view);
  const projects = useData(s => s.projects);
  const focusVerb = useFocusVerb(task.id);
  const due = (date: string | null) => void updateTask(task.id, {dueDate: date});

  return <>
    <DropdownMenuLinkItem href={href(view, task.id)}>Open task<DropdownMenuShortcut keys={['↵']}/></DropdownMenuLinkItem>
    <DropdownMenuItem onClick={() => void toggleFocus(task.id)}>{focusVerb}<DropdownMenuShortcut keys={['T']}/></DropdownMenuItem>
    <DropdownMenuSeparator/>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
      <DropdownMenuSubContent size="sm">
        <DropdownMenuRadioGroup value={task.status} onValueChange={v => void updateTask(task.id, {status: v as TaskStatus})}>
          {STATUSES.map((s, i) => <DropdownMenuRadioItem key={s} value={s}>
            {statusLabel[s]}<DropdownMenuShortcut keys={[String(i + 1)]}/>
          </DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Set priority</DropdownMenuSubTrigger>
      <DropdownMenuSubContent size="sm">
        <DropdownMenuRadioGroup value={String(task.priority)} onValueChange={v => void updateTask(task.id, {priority: Number(v) as Priority})}>
          {PRIORITIES.map(p => <DropdownMenuRadioItem key={p} value={String(p)}>{priorityLabel[p]}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Set due date</DropdownMenuSubTrigger>
      <DropdownMenuSubContent size="sm">
        <DropdownMenuItem onClick={() => due(today())}>Today</DropdownMenuItem>
        <DropdownMenuItem onClick={() => due(addDays(today(), 1))}>Tomorrow</DropdownMenuItem>
        <DropdownMenuItem onClick={() => due(addDays(today(), 7))}>In a week</DropdownMenuItem>
        <DropdownMenuLinkItem href={href(view, task.id)}>Pick a date</DropdownMenuLinkItem>
        {task.dueDate && <><DropdownMenuSeparator/><DropdownMenuItem onClick={() => due(null)}>Clear due date</DropdownMenuItem></>}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Move to project</DropdownMenuSubTrigger>
      <DropdownMenuSubContent size="sm">
        <DropdownMenuRadioGroup value={String(task.projectId ?? '')} onValueChange={v => void updateTask(task.id, {projectId: v ? Number(v) : null})}>
          <DropdownMenuRadioItem value="">No project</DropdownMenuRadioItem>
          {projects.filter(p => p.completedAt === null || p.id === task.projectId).map(p =>
            <DropdownMenuRadioItem key={p.id} value={String(p.id)}>{p.name}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuItem onClick={() => void copyTaskKey(task.id)}>Copy task ID<DropdownMenuShortcut keys={['⇧', '⌘', 'C']}/></DropdownMenuItem>
    <DropdownMenuSeparator/>
    <DropdownMenuItem variant="destructive" onClick={() => void deleteTask(task.id)}>Delete task<DropdownMenuShortcut keys={['⌫']}/></DropdownMenuItem>
  </>;
}

/** The More button on a card or row. */
export function TaskMenuButton({task, className}: {task: Task; className?: string}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${taskKey(task.seq)}`} className={className}/>}>
      <Icon icon={More}/>
    </DropdownMenuTrigger>
    <DropdownMenuContent size="sm" align="end">
      <TaskMenuItems task={task}/>
    </DropdownMenuContent>
  </DropdownMenu>;
}
