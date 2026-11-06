import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {arrayMove, sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {useCallback, useMemo, useRef, useState} from 'react';
import {DropdownMenu, DropdownMenuContent, DropdownMenuTrigger} from '@/components/glaze/ui/dropdown-menu';
import {taskKey} from '@/lib/domain/status';
import type {Task, TaskStatus} from '@/lib/domain/types';
import {moveTask} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';
import {TaskMenuItems} from '@/app/task/task-menu';
import {Column} from './column';
import {announcements, cardDragged, containerOf, instructions, keyboardDrag, type Columns} from './dnd';
import {TaskCard} from './task-card';

/** The columns, with cards that drag between them and a right-click menu on each card. */
export function BoardColumns({columns: base, older, statuses, tasks}: {
  columns: Columns;
  older: Record<TaskStatus, number>;
  statuses: TaskStatus[];
  tasks: Record<number, Task>;
}) {
  // While a card is carried, the columns follow it here; the store changes only when it lands.
  const [draft, setDraft] = useState<Columns | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const columns = draft ?? base;
  const live = useRef(columns);
  live.current = columns;
  const origin = useRef<{status: TaskStatus; index: number} | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {start: ['Space'], cancel: ['Escape'], end: ['Space']},
    }),
  );
  const accessibility = useMemo(() => ({announcements: announcements(() => live.current), screenReaderInstructions: instructions}), []);

  const onDragStart = ({active, activatorEvent}: DragStartEvent) => {
    const id = Number(active.id);
    const status = containerOf(id, base);
    if (!status) return;
    origin.current = {status, index: base[status].indexOf(id)};
    keyboardDrag.active = activatorEvent instanceof KeyboardEvent;
    setActive(id);
    setDraft(base);
  };

  const onDragOver = ({active, over}: DragOverEvent) => {
    if (!over) return;
    setDraft(current => {
      if (!current) return current;
      const from = containerOf(active.id, current);
      const to = containerOf(over.id, current);
      if (!from || !to || from === to) return current;
      const id = Number(active.id);
      const target = current[to];
      const overIndex = target.indexOf(Number(over.id));
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...current,
        [from]: current[from].filter(x => x !== id),
        [to]: [...target.slice(0, index), id, ...target.slice(index)],
      };
    });
  };

  const finish = () => {
    keyboardDrag.active = false;
    cardDragged.mark();
    setActive(null);
    setDraft(null);
  };

  const onDragEnd = ({active, over}: DragEndEvent) => {
    const current = draft;
    const start = origin.current;
    finish();
    if (!over || !current || !start) return;
    const id = Number(active.id);
    const status = containerOf(id, current);
    if (!status) return;
    let list = current[status];
    const overIndex = list.indexOf(Number(over.id));
    if (overIndex >= 0) list = arrayMove(list, list.indexOf(id), overIndex);
    const index = list.indexOf(id);
    if (status === start.status && index === start.index) return;
    void moveTask(id, status, list[index - 1] ?? null, list[index + 1] ?? null);
  };

  const onMenuTarget = useCallback((row: HTMLElement | null) => {
    const id = row?.querySelector<HTMLElement>('[data-task-id]')?.dataset.taskId;
    setMenuTask(id ? useData.getState().tasks[Number(id)] ?? null : null);
  }, []);

  return <DndContext
    sensors={sensors}
    collisionDetection={closestCorners}
    accessibility={accessibility}
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDragEnd={onDragEnd}
    onDragCancel={finish}
  >
    <DropdownMenu trigger="contextmenu" onTargetChange={onMenuTarget}>
      <DropdownMenuTrigger className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pt-2">
        {statuses.map(status => <Column key={status} status={status} ids={columns[status]} tasks={tasks} older={older[status]}/>)}
      </DropdownMenuTrigger>
      <DropdownMenuContent size="sm" aria-label={menuTask ? `Actions for ${taskKey(menuTask.seq)}` : 'Actions'}>
        {menuTask && <TaskMenuItems task={menuTask}/>}
      </DropdownMenuContent>
    </DropdownMenu>
    <DragOverlay>
      {active !== null && tasks[active] && <ul className="w-64"><TaskCard task={tasks[active]} overlay/></ul>}
    </DragOverlay>
  </DndContext>;
}
