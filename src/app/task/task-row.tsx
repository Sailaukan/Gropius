import {Focus, Pause} from '@/components/glaze/icon';
import {Item, ItemActions, ItemContent, ItemLink, ItemMeta, ItemTitle} from '@/components/glaze/ui/item';
import {taskKey} from '@/lib/domain/status';
import type {Task} from '@/lib/domain/types';
import {toggleFocus} from '@/lib/store/actions';
import {href, useUi} from '@/lib/store/ui';
import {IconButton} from '@/app/ui/icon-button';
import {DueMark, PriorityMark, TaskStatusMark, TaskTags} from './task-marks';
import {TaskMenuButton, useFocusVerb} from './task-menu';

/** A task as a row in a list: its title opens it, the meta says where it stands, and focus and More sit at the end. */
export function TaskRow({task, list, showDue = true, selected}: {task: Task; list: string; showDue?: boolean; selected?: boolean}) {
  const view = useUi(s => s.view);
  const open = useUi(s => s.task === task.id);
  const focusVerb = useFocusVerb(task.id);
  return <Item selected={selected ?? open}>
    <ItemContent>
      <ItemTitle>
        <ItemLink href={href(view, task.id)} data-task-link="" data-task-id={task.id} data-column={list} aria-current={open ? 'true' : undefined}>
          {task.title}
        </ItemLink>
        <span className="type-code-sm text-text-2">{taskKey(task.seq)}</span>
      </ItemTitle>
    </ItemContent>
    <ItemMeta className="flex items-center gap-2">
      <PriorityMark priority={task.priority}/>
      <TaskTags task={task}/>
      {showDue && <DueMark task={task}/>}
      <TaskStatusMark status={task.status} size="sm"/>
    </ItemMeta>
    <ItemActions>
      <IconButton label={`${focusVerb} on ${taskKey(task.seq)}`} icon={focusVerb === 'Pause focus' ? Pause : Focus} onClick={() => void toggleFocus(task.id)}/>
      <TaskMenuButton task={task}/>
    </ItemActions>
  </Item>;
}
