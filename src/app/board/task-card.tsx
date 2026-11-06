import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import type {MouseEvent} from 'react';
import {Focus, Icon} from '@/components/glaze/icon';
import {Status} from '@/components/glaze/ui/status';
import {taskKey} from '@/lib/domain/status';
import type {Task} from '@/lib/domain/types';
import {useData} from '@/lib/store/data';
import {href, useUi} from '@/lib/store/ui';
import {DueMark, PriorityMark, TaskTags} from '@/app/task/task-marks';
import {TaskMenuButton} from '@/app/task/task-menu';
import {cardDragged} from './dnd';

/**
 * One task on the board, as a Glaze card: the grey shell around the paper panel, with no footer, so a column shows as
 * many tasks as it can. Dates live in the task's details. The title's link covers the whole card, opens the task, and
 * is the handle that picks the card up; the More button sits above it.
 */
export function TaskCard({task, overlay = false}: {task: Task; overlay?: boolean}) {
  const view = useUi(s => s.view);
  const open = useUi(s => s.task === task.id);
  const focusing = useData(s => s.pomodoro?.task?.id === task.id && s.pomodoro.phase === 'focus' && s.pomodoro.status !== 'idle');
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} = useSortable({
    id: task.id,
    data: {status: task.status},
    attributes: {role: 'link', roleDescription: 'draggable task'},
    disabled: overlay,
  });
  const onClick = (event: MouseEvent) => {
    // The click that ends a drag is not a request to open the task.
    if (cardDragged.recently()) event.preventDefault();
  };

  return <li
    ref={overlay ? undefined : setNodeRef}
    // value-ok: dnd-kit moves the card with a transform it computes every frame; there is no class for that.
    style={overlay ? undefined : {transform: CSS.Translate.toString(transform), transition}}
    data-task-card=""
    className={[
      'shell relative list-none',
      'has-[[data-task-link]:focus-visible]:focus-ring',
      // The card stays faint where it was until it lands.
      isDragging ? 'opacity-40' : '',
      overlay ? 'border-line cursor-grabbing' : '',
    ].join(' ')}
  >
    <div className={`panel flex flex-col gap-2 p-3 ${open ? 'bg-pressed' : ''}`}>
      <h3 className="type-label text-text-1">
        <a
          ref={overlay ? undefined : setActivatorNodeRef}
          href={href(view, task.id)}
          data-task-link=""
          data-task-id={task.id}
          data-column={task.status}
          data-control=""
          className="line-clamp-3 after:absolute after:inset-0 after:rounded-shell after:content-[''] hover:underline hover:decoration-1 hover:underline-offset-2"
          onClick={onClick}
          aria-current={open ? 'true' : undefined}
          {...(overlay ? {} : attributes)}
          {...(overlay ? {} : listeners)}
        >
          {task.title}
        </a>
      </h3>
      {/* Drawn first, but after the title in the DOM, so Tab reaches the card's link before its More button. */}
      <div className="order-first flex min-h-4 items-center gap-2">
        <span className="type-code-xs text-text-2">{taskKey(task.seq)}</span>
        {focusing && <Status status="running" size="sm">Focusing</Status>}
        <span className="ms-auto flex items-center gap-2">
          {task.pomodorosCompleted > 0 && <span className="inline-flex items-center gap-1 type-caption text-text-2" title={`${task.pomodorosCompleted} focus sessions`}>
            <Icon icon={Focus} size={12}/>
            <span className="data">{task.pomodorosCompleted}</span>
            <span className="sr-only"> focus sessions</span>
          </span>}
          <PriorityMark priority={task.priority}/>
        </span>
        {/* Pulled out by its own padding, so the row keeps its height and the glyph lines up with the panel's text. */}
        <TaskMenuButton task={task} className="relative z-(--z-raised) -my-1.5 -ms-1 -me-1.5"/>
      </div>
      <TaskFacts task={task}/>
    </div>
  </li>;
}

/** The project, contexts and due date, when the task has any. */
function TaskFacts({task}: {task: Task}) {
  const hasFacts = task.projectId !== null || task.contextIds.length > 0 || task.dueDate !== null;
  if (!hasFacts) return null;
  return <div className="flex flex-wrap items-center gap-1">
    <TaskTags task={task}/>
    <DueMark task={task}/>
  </div>;
}
