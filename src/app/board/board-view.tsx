import {useMemo} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle} from '@/components/glaze/ui/empty-state';
import {Kbd} from '@/components/glaze/ui/kbd';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/glaze/ui/tooltip';
import {byStatus, isOld} from '@/lib/domain/selectors';
import {acceleratorKeys} from '@/lib/domain/accelerator';
import {STATUSES} from '@/lib/domain/status';
import type {TaskStatus} from '@/lib/domain/types';
import {useData, useSettings} from '@/lib/store/data';
import {useUi} from '@/lib/store/ui';
import {ViewHeader} from '@/app/shell/view-header';
import {BoardColumns} from './board-columns';
import {BoardFilterBar, useBoardFilter} from './board-filter-bar';
import {DisplayOptions} from './display-options';
import type {Columns} from './dnd';

export function BoardView() {
  const tasks = useData(s => s.tasks);
  const settings = useSettings();
  const showOlder = useUi(s => s.showOlder);
  const all = useMemo(() => Object.values(tasks), [tasks]);
  const filter = useBoardFilter(all);
  const {rows, filtered} = filter;

  const visible = STATUSES.filter(s => settings.visibleColumns.includes(s));
  const {columns, older} = useMemo(() => {
    const grouped = byStatus(rows);
    const columns = {} as Columns;
    const older = {} as Record<TaskStatus, number>;
    for (const status of STATUSES) {
      const list = grouped[status];
      const recent = list.filter(t => !isOld(t, settings.completedDays));
      older[status] = list.length - recent.length;
      columns[status] = (showOlder[status] ? list : recent).map(t => t.id);
    }
    return {columns, older};
  }, [rows, settings.completedDays, showOlder]);

  const shown = visible.filter(s => settings.showEmptyColumns || columns[s].length > 0 || older[s] > 0);
  const boardEmpty = all.length === 0;
  const nothingMatches = !boardEmpty && filtered && rows.length === 0;

  return <>
    <ViewHeader title="Board" actions={<>
      <DisplayOptions/>
      <Tooltip>
        <TooltipTrigger render={<Button size="sm" onClick={() => useUi.getState().openNewTask()} aria-keyshortcuts="C"/>}>New task</TooltipTrigger>
        <TooltipContent shortcut={['C']}>New task</TooltipContent>
      </Tooltip>
    </>}/>
    <BoardFilterBar all={all} filter={filter}/>
    {boardEmpty
      ? <BoardEmpty/>
      : nothingMatches
        ? <NoMatches/>
        : <BoardColumns columns={columns} older={older} statuses={shown} tasks={tasks}/>}
  </>;
}

function BoardEmpty() {
  const shortcut = useSettings().captureShortcut;
  return <div className="flex flex-1 items-center justify-center p-6">
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No tasks yet</EmptyTitle>
        <EmptyDescription>Press <Kbd keys="c"/> to add one, or capture from any app with <Kbd keys={acceleratorKeys(shortcut)}/>.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="secondary" onClick={() => useUi.getState().openNewTask()}>Add task</Button>
      </EmptyContent>
    </Empty>
  </div>;
}

function NoMatches() {
  const search = useUi(s => s.filters.search);
  return <div className="flex flex-1 items-center justify-center p-6">
    <Empty reason="no-results">
      <EmptyHeader>
        <EmptyTitle>{search ? <>No tasks match <code>{search}</code></> : 'No tasks match these filters'}</EmptyTitle>
        <EmptyDescription>Clear the filters to see the whole board.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="secondary" onClick={() => useUi.getState().clearFilters()}>Clear filters</Button>
      </EmptyContent>
    </Empty>
  </div>;
}
