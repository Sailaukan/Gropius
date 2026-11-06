import {useEffect, useState, useSyncExternalStore} from 'react';
import {Icon, More} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {DropdownMenu, DropdownMenuContent, DropdownMenuTrigger} from '@/components/glaze/ui/dropdown-menu';
import {Field, FieldLabel} from '@/components/glaze/ui/field';
import {RelativeTime} from '@/components/glaze/ui/relative-time';
import {
  Sheet, SheetAction, SheetBody, SheetClose, SheetContent, SheetDescription, SheetField, SheetFooter, SheetHeader,
  SheetSection, SheetTitle, useSheet,
} from '@/components/glaze/ui/sheet';
import {Textarea} from '@/components/glaze/ui/textarea';
import {shortDate} from '@/lib/domain/dates';
import {isClosed, statusLabel, taskKey} from '@/lib/domain/status';
import type {Task} from '@/lib/domain/types';
import {toggleFocus, updateTask} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';
import {closeTask, useUi} from '@/lib/store/ui';
import {FocusSection} from './focus-section';
import {ContextsPicker, DuePicker, PriorityPicker, ProjectPicker, StatusPicker} from './property-pills';
import {TaskMenuItems, useFocusVerb} from './task-menu';

const WIDTH_KEY = 'gropius.sheet-width';
const WIDE = window.matchMedia('(min-width: 1200px)');

/** Whether the window is wide enough to keep the board usable beside a docked sheet. */
function useWideWindow(): boolean {
  return useSyncExternalStore(
    notify => {
      WIDE.addEventListener('change', notify);
      return () => WIDE.removeEventListener('change', notify);
    },
    () => WIDE.matches,
  );
}

function savedWidth(): number {
  try {
    return Number(localStorage.getItem(WIDTH_KEY)) || 400;
  } catch {
    return 400;
  }
}

/** The open task's details, docked beside the board or list so it stays in view. */
export function TaskSheet() {
  const id = useUi(s => s.task);
  const task = useData(s => (id !== null ? s.tasks[id] : undefined));
  const loaded = useData(s => s.loaded);

  // A link to a task that is gone (deleted elsewhere) closes the sheet rather than showing nothing.
  useEffect(() => {
    if (loaded && id !== null && !task) closeTask();
  }, [loaded, id, task]);

  // Beside the board when the window has room for both; over it, as a modal sheet, when it does not.
  const docked = useWideWindow();
  return <Sheet modal={!docked} open={Boolean(task)} onOpenChange={open => { if (!open) closeTask(); }}>
    <SheetContent
      side="end"
      defaultWidth={savedWidth()}
      minWidth={340}
      maxWidth={640}
      onWidthChange={width => { try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* the width is a convenience */ } }}
    >
      {task && <TaskDetails key={task.id} task={task}/>}
    </SheetContent>
  </Sheet>;
}

function TaskDetails({task}: {task: Task}) {
  const {trigger} = useSheet();
  const project = useData(s => s.projects.find(p => p.id === task.projectId));
  const focusVerb = useFocusVerb(task.id);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  // Escape and Close hand focus back to the card or row that opened the task.
  useEffect(() => {
    const from = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-task-link]');
    if (from) (trigger as React.RefObject<HTMLElement | null>).current = from;
  }, [trigger]);
  // Keep the fields in step when the task changes elsewhere, unless the person is typing in them.
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description), [task.description]);

  const saveTitle = () => {
    if (!title.trim()) setTitle(task.title);
    else if (title !== task.title) void updateTask(task.id, {title});
  };
  const saveDescription = () => {
    if (description !== task.description) void updateTask(task.id, {description});
  };
  const closed = isClosed(task.status);

  return <>
    <SheetHeader>
      <div className="flex items-center gap-2">
        <SheetTitle><span className="mono">{taskKey(task.seq)}</span></SheetTitle>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${taskKey(task.seq)}`}/>}>
            <Icon icon={More}/>
          </DropdownMenuTrigger>
          <DropdownMenuContent size="sm"><TaskMenuItems task={task}/></DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SheetDescription>
        {[statusLabel[task.status], project?.name, `created ${shortDate(task.createdAt)}`].filter(Boolean).join(' · ')}
      </SheetDescription>
    </SheetHeader>
    <SheetBody>
      <Field>
        <FieldLabel>Title</FieldLabel>
        <Textarea
          autoGrow
          minRows={1}
          maxRows={4}
          value={title}
          onValueChange={setTitle}
          onBlur={saveTitle}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </Field>
      <Field>
        <FieldLabel>Description</FieldLabel>
        <Textarea
          autoGrow
          minRows={4}
          maxRows={16}
          placeholder="Add notes, links or the next step"
          value={description}
          onValueChange={setDescription}
          onBlur={saveDescription}
        />
      </Field>
      <SheetSection title="Properties">
        <SheetField label="Status"><StatusPicker value={task.status} onChange={status => void updateTask(task.id, {status})}/></SheetField>
        <SheetField label="Priority"><PriorityPicker value={task.priority} onChange={priority => void updateTask(task.id, {priority})}/></SheetField>
        <SheetField label="Project"><ProjectPicker value={task.projectId} onChange={projectId => void updateTask(task.id, {projectId})}/></SheetField>
        <SheetField label="Contexts"><ContextsPicker value={task.contextIds} onChange={contextIds => void updateTask(task.id, {contextIds})}/></SheetField>
        <SheetField label="Due"><DuePicker value={task.dueDate} onChange={dueDate => void updateTask(task.id, {dueDate})}/></SheetField>
      </SheetSection>
      <FocusSection task={task}/>
      <SheetSection title="Activity">
        <SheetField label="Created"><RelativeTime date={task.createdAt} format="long"/></SheetField>
        {task.startedAt && <SheetField label="Started"><RelativeTime date={task.startedAt} format="long"/></SheetField>}
        {task.completedAt && <SheetField label="Done"><RelativeTime date={task.completedAt} format="long"/></SheetField>}
        {task.cancelledAt && <SheetField label="Cancelled"><RelativeTime date={task.cancelledAt} format="long"/></SheetField>}
        {task.reviewedAt && <SheetField label="Last reviewed"><RelativeTime date={task.reviewedAt} format="long"/></SheetField>}
      </SheetSection>
    </SheetBody>
    <SheetFooter>
      <SheetClose>Close</SheetClose>
      {closed
        ? <SheetAction close={false} onClick={() => void updateTask(task.id, {status: 'todo'})}>Reopen task</SheetAction>
        : <SheetAction close={false} onClick={() => void toggleFocus(task.id)} aria-keyshortcuts="T">{focusVerb}</SheetAction>}
    </SheetFooter>
  </>;
}
