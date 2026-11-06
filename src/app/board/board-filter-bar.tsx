import {useCallback, useMemo} from 'react';
import {
  FilterBar, FilterBarClear, FilterBarCount, FilterBarSearch, FilterBarSelect, useFilteredRows, type FacetField,
} from '@/components/glaze/ui/filter-bar';
import {PRIORITIES, priorityLabel} from '@/lib/domain/priority';
import {dueValues, matchesSearch} from '@/lib/domain/selectors';
import type {Task} from '@/lib/domain/types';
import {useData, useSettings} from '@/lib/store/data';
import {useUi, type FilterField} from '@/lib/store/ui';

const DUE_OPTIONS = [
  {value: 'overdue', label: 'Overdue'},
  {value: 'today', label: 'Due today'},
  {value: 'week', label: 'This week'},
  {value: 'none', label: 'No due date'},
];

/** The board's tasks narrowed by the search and filters, with each option's count for the filter menus. */
export function useBoardFilter(all: Task[]) {
  const filters = useUi(s => s.filters);
  const projects = useData(s => s.projects);
  const contexts = useData(s => s.contexts);
  const {weekStartsOn} = useSettings();

  const fields = useMemo<FacetField<Task>[]>(() => [
    {id: 'project', value: t => (t.projectId ? String(t.projectId) : 'none')},
    {id: 'context', value: t => t.contextIds.map(String)},
    {id: 'priority', value: t => String(t.priority)},
    {id: 'due', value: t => dueValues(t, weekStartsOn)},
  ], [weekStartsOn]);
  const match = useCallback((task: Task, query: string) => matchesSearch(
    task, query, new Map(projects.map(p => [p.id, p])), new Map(contexts.map(c => [c.id, c])),
  ), [projects, contexts]);
  const chosen = useMemo(() => ({
    project: filters.project, context: filters.context, priority: filters.priority, due: filters.due,
  }), [filters.project, filters.context, filters.priority, filters.due]);

  const {rows, counts} = useFilteredRows(all, {search: filters.search, match, fields, filters: chosen});
  const filtered = filters.search.trim() !== '' || Object.values(chosen).some(v => v.length > 0);
  return {rows, counts, filtered};
}

export function BoardFilterBar({all, filter: {rows, counts, filtered}}: {all: Task[]; filter: ReturnType<typeof useBoardFilter>}) {
  const filters = useUi(s => s.filters);
  const setFilters = useUi(s => s.setFilters);
  const projects = useData(s => s.projects);
  const contexts = useData(s => s.contexts);
  const set = (field: FilterField) => (value: string | string[]) =>
    setFilters({[field]: Array.isArray(value) ? value : value ? [value] : []});

  return <div className="shrink-0 px-5 py-2">
    <FilterBar aria-label="Filter tasks">
      <FilterBarSearch value={filters.search} onValueChange={search => setFilters({search})} placeholder="Search tasks"/>
      <FilterBarSelect
        label="Project"
        multiple
        value={filters.project}
        onValueChange={set('project')}
        options={[
          ...projects.filter(p => p.completedAt === null || filters.project.includes(String(p.id)))
            .map(p => ({value: String(p.id), label: p.name, count: counts.project[String(p.id)] ?? 0})),
          {value: 'none', label: 'No project', count: counts.project.none ?? 0},
        ]}
      />
      <FilterBarSelect
        label="Context"
        multiple
        value={filters.context}
        onValueChange={set('context')}
        options={contexts.map(c => ({value: String(c.id), label: c.name, count: counts.context[String(c.id)] ?? 0}))}
      />
      <FilterBarSelect
        label="Priority"
        multiple
        value={filters.priority}
        onValueChange={set('priority')}
        options={PRIORITIES.map(p => ({value: String(p), label: priorityLabel[p], count: counts.priority[String(p)] ?? 0}))}
      />
      <FilterBarSelect
        label="Due"
        multiple
        value={filters.due}
        onValueChange={set('due')}
        options={DUE_OPTIONS.map(o => ({...o, count: counts.due[o.value] ?? 0}))}
      />
      <FilterBarCount shown={rows.length} total={all.length} noun="tasks"/>
      {filtered && <FilterBarClear onClick={() => useUi.getState().clearFilters()}/>}
    </FilterBar>
  </div>;
}
