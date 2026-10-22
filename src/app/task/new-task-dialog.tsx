import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {
  Dialog, DialogAction, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/glaze/ui/dialog';
import {Field, FieldLabel} from '@/components/glaze/ui/field';
import {Input} from '@/components/glaze/ui/input';
import {Switch} from '@/components/glaze/ui/switch';
import {Textarea} from '@/components/glaze/ui/textarea';
import {toast} from '@/components/glaze/ui/toast';
import {statusLabel, taskKey} from '@/lib/domain/status';
import type {Priority, TaskStatus} from '@/lib/domain/types';
import {commands, errorText} from '@/lib/tauri/commands';
import {useData} from '@/lib/store/data';
import {navigate, useUi} from '@/lib/store/ui';
import {ContextsPicker, DuePicker, PriorityPicker, ProjectPicker, StatusPicker} from './property-pills';

/** Linear's new issue modal in Glaze: a title, a description, the properties as pills, and Create more. */
export function NewTaskDialog() {
  const {open, defaults} = useUi(s => s.newTask);
  const close = useUi(s => s.closeNewTask);
  const titleRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<Priority>(0);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [contextIds, setContextIds] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [createMore, setCreateMore] = useState(false);

  // Each opening starts clean, from where it was opened: a column's + sets its status, a filtered board its project.
  useEffect(() => {
    if (!open) return;
    const filters = useUi.getState().filters;
    setTitle('');
    setDescription('');
    setStatus(defaults.status ?? 'todo');
    setPriority(defaults.priority ?? 0);
    setProjectId(defaults.projectId ?? (filters.project.length === 1 && filters.project[0] !== 'none' ? Number(filters.project[0]) : null));
    setContextIds(defaults.contextIds ?? filters.context.map(Number));
    setDueDate(defaults.dueDate ?? null);
  }, [open, defaults]);

  const create = async () => {
    if (!title.trim()) {
      titleRef.current?.focus();
      throw new Error('Write a title for the task.');
    }
    try {
      const task = await commands.createTask({title, description, status, priority, projectId, contextIds, dueDate, processed: defaults.processed ?? true});
      useData.getState().upsertTasks([task]);
      if (createMore) {
        setTitle('');
        setDescription('');
        titleRef.current?.focus();
        toast(`Created ${taskKey(task.seq)}`, {
          description: `In ${statusLabel[task.status]}`,
          action: {label: 'Open task', onClick: () => navigate(useUi.getState().view, task.id)},
        });
      }
    } catch (error) {
      throw new Error(errorText(error));
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      actionRef.current?.click();
    }
  };

  return <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
    <DialogContent size="lg" initialFocus={titleRef} onKeyDown={onKeyDown}>
      <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
      <DialogBody>
        <Input
          ref={titleRef}
          size="lg"
          aria-label="Title"
          placeholder="Book the car service"
          value={title}
          onChange={event => setTitle(event.target.value)}
          onKeyDown={event => {
            // Enter moves on to the description; ⌘↵ creates.
            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              document.getElementById('new-task-description')?.focus();
            }
          }}
        />
        <Textarea
          id="new-task-description"
          aria-label="Description"
          placeholder="Ask for the 10am slot and a courtesy car."
          autoGrow
          minRows={3}
          maxRows={12}
          value={description}
          onValueChange={setDescription}
        />
        <div role="group" aria-label="Task properties" className="flex flex-wrap items-center gap-2">
          <StatusPicker value={status} onChange={setStatus}/>
          <PriorityPicker value={priority} onChange={setPriority}/>
          <ProjectPicker value={projectId} onChange={setProjectId}/>
          <ContextsPicker value={contextIds} onChange={setContextIds}/>
          <DuePicker value={dueDate} onChange={setDueDate}/>
        </div>
      </DialogBody>
      <DialogFooter
        defaultAction="none"
        meta={<Field orientation="horizontal" className="w-auto">
          <Switch size="sm" checked={createMore} onCheckedChange={setCreateMore}/>
          <FieldLabel>Create more</FieldLabel>
        </Field>}
      >
        <DialogClose>Cancel</DialogClose>
        <DialogAction ref={actionRef} onAction={create} close={!createMore} pendingLabel="Creating" aria-keyshortcuts="Meta+Enter">
          Create task
        </DialogAction>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
