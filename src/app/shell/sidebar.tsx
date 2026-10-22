import {useMemo, type MouseEvent} from 'react';
import {
  Add, Board, Context as ContextIcon, Icon, Inbox, Project as ProjectIcon, Review, Search, Settings, Sidebar as SidebarIcon,
  Today, type GlazeIcon,
} from '@/components/glaze/icon';
import {Badge} from '@/components/glaze/ui/badge';
import {Button} from '@/components/glaze/ui/button';
import {Item, ItemContent, ItemLink, ItemMedia, ItemTitle} from '@/components/glaze/ui/item';
import {Kbd} from '@/components/glaze/ui/kbd';
import {DAY_MS} from '@/lib/domain/dates';
import {isInbox, todayBuckets} from '@/lib/domain/selectors';
import {updateSettings} from '@/lib/store/actions';
import {useData, useSettings} from '@/lib/store/data';
import {filterBoard, href, useUi, type View} from '@/lib/store/ui';
import {IconButton} from '@/app/ui/icon-button';

const WEEK_MS = 7 * DAY_MS;

function NavRow({icon, label, link, selected, count, onClick, extra}: {
  icon?: GlazeIcon;
  label: string;
  link: string;
  selected: boolean;
  count?: number;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  extra?: React.ReactNode;
}) {
  // The li rounds the row's wash; Item itself keeps its own shape.
  return <li className="overflow-hidden rounded-tag"><Item size="sm" selected={selected}>
    {icon && <ItemMedia variant="icon"><Icon icon={icon}/></ItemMedia>}
    <ItemContent>
      <ItemTitle>
        <ItemLink href={link} aria-current={selected ? 'page' : undefined} onClick={onClick}>{label}</ItemLink>
        {extra}
        {count ? <span className="ms-auto type-caption text-text-2">{count}</span> : null}
      </ItemTitle>
    </ItemContent>
  </Item></li>;
}

export function Sidebar() {
  const view = useUi(s => s.view);
  const filters = useUi(s => s.filters);
  const tasks = useData(s => s.tasks);
  const projects = useData(s => s.projects);
  const contexts = useData(s => s.contexts);
  const settings = useSettings();

  const counts = useMemo(() => {
    const all = Object.values(tasks);
    const today = todayBuckets(all);
    return {inbox: all.filter(isInbox).length, today: today.overdue.length + today.dueToday.length};
  }, [tasks]);
  const reviewDue = settings.lastReviewAt === null || Date.now() - settings.lastReviewAt > WEEK_MS;
  const activeProjects = projects.filter(p => p.completedAt === null);

  const onlyFilter = (field: 'project' | 'context', id: number) =>
    view === 'board' && filters[field].length === 1 && filters[field][0] === String(id)
    && filters.search === '' && filters[field === 'project' ? 'context' : 'project'].length === 0;
  const plainBoard = view === 'board' && !activeProjects.some(p => onlyFilter('project', p.id))
    && !contexts.some(c => onlyFilter('context', c.id));
  const isView = (v: View) => view === v && (v !== 'board' || plainBoard);

  return <nav aria-label="Main" className="flex w-54 shrink-0 flex-col border-e border-line-faint">
    <div data-tauri-drag-region="deep" className="flex h-13 shrink-0 items-center justify-end px-3">
      <IconButton label="Hide sidebar" icon={SidebarIcon} shortcut={['[']} onClick={() => void updateSettings({sidebarCollapsed: true})}/>
    </div>

    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2 pb-4">
      <Button variant="secondary" size="sm" className="w-full" onClick={() => { useUi.getState().focusTask(null); useUi.getState().setPaletteOpen(true); }}>
        <Icon icon={Search}/>Search<Kbd keys="mod+k" className="ms-auto"/>
      </Button>

      <ul aria-label="Views" className="flex flex-col">
        <NavRow icon={Inbox} label="Inbox" link={href('inbox')} selected={isView('inbox')} count={counts.inbox}/>
        <NavRow icon={Today} label="Today" link={href('today')} selected={isView('today')} count={counts.today}/>
        <NavRow icon={Board} label="Board" link={href('board')} selected={isView('board')}
          onClick={() => useUi.getState().clearFilters()}/>
        <NavRow icon={Review} label="Weekly review" link={href('review')} selected={isView('review')}
          extra={reviewDue ? <Badge size="sm" className="ms-auto">Due</Badge> : undefined}/>
        <NavRow icon={ProjectIcon} label="Projects" link={href('projects')} selected={isView('projects')}/>
      </ul>

      <section aria-labelledby="sidebar-projects" className="flex flex-col gap-1">
        <div className="flex items-center justify-between ps-3">
          <h2 id="sidebar-projects" className="type-label-sm text-text-2">Projects</h2>
          <IconButton label="Create project" icon={Add} onClick={() => useUi.getState().setProjectDialogOpen(true)}/>
        </div>
        {activeProjects.length
          ? <ul aria-label="Active projects" className="flex flex-col">
            {activeProjects.map(p => <NavRow key={p.id} label={p.name} link={href('board')}
              selected={onlyFilter('project', p.id)} onClick={() => filterBoard('project', p.id)}/>)}
          </ul>
          : <p className="ps-3 type-caption text-text-2">No projects yet</p>}
      </section>

      <section aria-labelledby="sidebar-contexts" className="flex flex-col gap-1">
        <div className="flex items-center justify-between ps-3">
          <h2 id="sidebar-contexts" className="type-label-sm text-text-2">Contexts</h2>
          <IconButton label="Create context" icon={Add} onClick={() => useUi.getState().openSettings('contexts')}/>
        </div>
        <ul aria-label="Contexts" className="flex flex-col">
          {contexts.map(c => <NavRow key={c.id} icon={ContextIcon} label={c.name.slice(1)} link={href('board')}
            selected={onlyFilter('context', c.id)} onClick={() => filterBoard('context', c.id)}/>)}
        </ul>
      </section>
    </div>

    <div className="shrink-0 border-t border-line-faint px-2 py-2">
      <Button variant="ghost" size="sm" onClick={() => useUi.getState().openSettings()} aria-keyshortcuts="Meta+Comma">
        <Icon icon={Settings}/>Settings
      </Button>
    </div>
  </nav>;
}
