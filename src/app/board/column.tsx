import {useDroppable} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {Add, Icon, More} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/glaze/ui/dropdown-menu';
import {Empty, EmptyHeader, EmptyTitle} from '@/components/glaze/ui/empty-state';
import {Status} from '@/components/glaze/ui/status';
import {isClosed, statusLabel} from '@/lib/domain/status';
import type {Task, TaskStatus} from '@/lib/domain/types';
import {setColumnVisible} from '@/lib/store/actions';
import {useSettings} from '@/lib/store/data';
import {useUi} from '@/lib/store/ui';
import {IconButton} from '@/app/ui/icon-button';
import {TaskStatusMark} from '@/app/task/task-marks';
import {columnId} from './dnd';
import {TaskCard} from './task-card';

interface ColumnProps {
  status: TaskStatus;
  ids: number[];
  tasks: Record<number, Task>;
  /** Closed tasks past the board's window, hidden until asked for. */
  older: number;
}

export function Column({status, ids, tasks, older}: ColumnProps) {
  const {setNodeRef, isOver} = useDroppable({id: columnId(status)});
  const showOlder = useUi(s => Boolean(s.showOlder[status]));
  const label = statusLabel[status];

  return <section aria-labelledby={`column-${status}`} className="flex min-h-0 w-64 shrink-0 flex-col">
    <ColumnHeader status={status} count={ids.length} older={older}/>
    <SortableContext id={columnId(status)} items={ids} strategy={verticalListSortingStrategy}>
      <ul
        ref={setNodeRef}
        aria-label={`${label} tasks`}
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-shell p-1 pb-6 transition-colors duration-(--dur-state) ease-out ${isOver ? 'bg-hover-row' : ''}`}
      >
        {ids.map(id => tasks[id] && <TaskCard key={id} task={tasks[id]}/>)}
        {!ids.length && <li className="list-none">
          <Empty variant="plain" size="sm">
            <EmptyHeader><EmptyTitle>No tasks</EmptyTitle></EmptyHeader>
          </Empty>
        </li>}
        {older > 0 && <li className="list-none">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => useUi.getState().toggleOlder(status)}>
            {showOlder ? `Hide ${older} older tasks` : `Show ${older} older tasks`}
          </Button>
        </li>}
      </ul>
    </SortableContext>
  </section>;
}

function ColumnHeader({status, count, older}: {status: TaskStatus; count: number; older: number}) {
  const settings = useSettings();
  const showOlder = useUi(s => Boolean(s.showOlder[status]));
  const label = statusLabel[status];
  const overLimit = status === 'in_progress' && settings.wipLimit > 0 && count > settings.wipLimit;
  const addTask = () => useUi.getState().openNewTask({status});

  return <div className="flex h-(--row) shrink-0 items-center gap-2 ps-3 pe-1">
    <h2 id={`column-${status}`} className="flex min-w-0 items-center"><TaskStatusMark status={status}/></h2>
    <span className="type-caption text-text-2" aria-label={`${count} tasks`}>{count}</span>
    {overLimit && <Status status="warn" size="sm">Over limit</Status>}
    <div className="ms-auto flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for the ${label} column`}/>}>
          <Icon icon={More}/>
        </DropdownMenuTrigger>
        <DropdownMenuContent size="sm" align="end">
          <DropdownMenuItem onClick={addTask}>Add task<DropdownMenuShortcut keys={['C']}/></DropdownMenuItem>
          {isClosed(status) && older > 0 && <DropdownMenuCheckboxItem checked={showOlder} onCheckedChange={() => useUi.getState().toggleOlder(status)}>
            Show older tasks
          </DropdownMenuCheckboxItem>}
          <DropdownMenuSeparator/>
          <DropdownMenuItem disabled={settings.visibleColumns.length === 1} onClick={() => setColumnVisible(status, false)}>
            Hide column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label={`Add task to ${label}`} icon={Add} onClick={addTask}/>
    </div>
  </div>;
}
