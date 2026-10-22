import {useMemo, useState} from 'react';
import {More, Icon} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/glaze/ui/collapsible';
import {
  Dialog, DialogAction, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/glaze/ui/dialog';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from '@/components/glaze/ui/dropdown-menu';
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle} from '@/components/glaze/ui/empty-state';
import {Field, FieldLabel} from '@/components/glaze/ui/field';
import {Input} from '@/components/glaze/ui/input';
import {Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemLink, ItemMeta, ItemTitle} from '@/components/glaze/ui/item';
import {Status} from '@/components/glaze/ui/status';
import {Textarea} from '@/components/glaze/ui/textarea';
import {projectStats, type ProjectStats} from '@/lib/domain/selectors';
import type {Project} from '@/lib/domain/types';
import {commands, errorText} from '@/lib/tauri/commands';
import {deleteProject, updateProject} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';
import {href, NO_FILTERS, useUi} from '@/lib/store/ui';
import {ViewHeader} from '@/app/shell/view-header';

/** Every project, with how much is open and whether it has a next action. */
export function ProjectsView() {
  const projects = useData(s => s.projects);
  const tasks = useData(s => s.tasks);
  const stats = useMemo(() => projectStats(Object.values(tasks)), [tasks]);
  const [editing, setEditing] = useState<Project | null>(null);
  const active = projects.filter(p => p.completedAt === null);
  const completed = projects.filter(p => p.completedAt !== null);

  return <>
    <ViewHeader title="Projects" actions={
      <Button size="sm" onClick={() => useUi.getState().setProjectDialogOpen(true)}>New project</Button>
    }/>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
        {projects.length === 0
          ? <Empty>
            <EmptyHeader>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>A project is any outcome that takes more than one step.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" variant="secondary" onClick={() => useUi.getState().setProjectDialogOpen(true)}>Create project</Button>
            </EmptyContent>
          </Empty>
          : <>
            {active.length > 0 && <ItemGroup aria-label="Active projects">
              {active.map(p => <ProjectRow key={p.id} project={p} stats={stats.get(p.id)} onRename={() => setEditing(p)}/>)}
            </ItemGroup>}
            {completed.length > 0 && <Collapsible>
              <CollapsibleTrigger summary={String(completed.length)}>Completed projects</CollapsibleTrigger>
              <CollapsibleContent>
                <ItemGroup aria-label="Completed projects" className="mt-2">
                  {completed.map(p => <ProjectRow key={p.id} project={p} stats={stats.get(p.id)} onRename={() => setEditing(p)}/>)}
                </ItemGroup>
              </CollapsibleContent>
            </Collapsible>}
          </>}
      </div>
    </div>
    <EditProjectDialog project={editing} onClose={() => setEditing(null)}/>
  </>;
}

function ProjectRow({project, stats, onRename}: {project: Project; stats?: ProjectStats; onRename: () => void}) {
  const open = stats?.open ?? 0;
  const done = project.completedAt !== null;
  return <Item>
    <ItemContent>
      <ItemTitle>
        <ItemLink href={href('board')} onClick={() => useUi.getState().setFilters({...NO_FILTERS, project: [String(project.id)]})}>
          {project.name}
        </ItemLink>
      </ItemTitle>
      {project.outcome && <ItemDescription>{project.outcome}</ItemDescription>}
    </ItemContent>
    <ItemMeta>{open === 1 ? '1 open task' : `${open} open tasks`}</ItemMeta>
    {done
      ? <Status status="ok" size="sm">Completed</Status>
      : open > 0 && !stats?.hasNextAction && <Status status="warn" size="sm">No next action</Status>}
    <ItemActions>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${project.name}`}/>}>
          <Icon icon={More}/>
        </DropdownMenuTrigger>
        <DropdownMenuContent size="sm" align="end">
          <DropdownMenuItem onClick={() => useUi.getState().openNewTask({projectId: project.id, status: 'todo'})}>Add task</DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>Edit project</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void updateProject(project.id, {completed: !done})}>
            {done ? 'Reopen project' : 'Complete project'}
          </DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem variant="destructive" onClick={() => void deleteProject(project.id)}>Delete project</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ItemActions>
  </Item>;
}

function EditProjectDialog({project, onClose}: {project: Project | null; onClose: () => void}) {
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState('');
  const [shown, setShown] = useState<Project | null>(null);
  // Keep the last project while the dialog fades out.
  if (project && project !== shown) {
    setShown(project);
    setName(project.name);
    setOutcome(project.outcome);
  }

  const save = async () => {
    if (!shown) return;
    if (!name.trim()) throw new Error('Write a name for the project.');
    try {
      useData.getState().setProjects(await commands.updateProject(shown.id, {name, outcome}));
    } catch (error) {
      throw new Error(errorText(error));
    }
  };

  return <Dialog open={project !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent size="sm">
      <DialogHeader><DialogTitle>Edit {shown?.name ?? 'project'}</DialogTitle></DialogHeader>
      <DialogBody>
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={e => setName(e.target.value)}/>
        </Field>
        <Field>
          <FieldLabel optional>Outcome</FieldLabel>
          <Textarea autoGrow minRows={2} maxRows={6} value={outcome} onValueChange={setOutcome}/>
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose>Cancel</DialogClose>
        <DialogAction onAction={save} pendingLabel="Saving">Save project</DialogAction>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
