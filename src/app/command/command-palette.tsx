import {useMemo} from 'react';
import {
  Command, CommandDialog, CommandEmpty, CommandFooter, CommandGroup, CommandHint, CommandInput, CommandItem, CommandLabel,
  CommandList, CommandShortcut,
} from '@/components/glaze/ui/command';
import {STATUSES, statusLabel, taskKey} from '@/lib/domain/status';
import type {TaskStatus} from '@/lib/domain/types';
import {copyTaskKey, deleteTask, setColumnVisible, timer, toggleFocus, undoLast, updateSettings, updateTask} from '@/lib/store/actions';
import {getSettings, useData} from '@/lib/store/data';
import {filterBoard, navigate, useUi, type View} from '@/lib/store/ui';

const GO_TO: {view: View; label: string; keys: string[]}[] = [
  {view: 'inbox', label: 'Go to Inbox', keys: ['⌘', '1']},
  {view: 'today', label: 'Go to Today', keys: ['⌘', '2']},
  {view: 'board', label: 'Go to Board', keys: ['⌘', '3']},
  {view: 'review', label: 'Go to Weekly review', keys: ['⌘', '4']},
  {view: 'projects', label: 'Go to Projects', keys: ['⌘', '5']},
];

/** ⌘K: find a task or run any command by typing. */
export function CommandPalette() {
  const open = useUi(s => s.paletteOpen);
  const setOpen = useUi(s => s.setPaletteOpen);
  const tasks = useData(s => s.tasks);
  const projects = useData(s => s.projects);
  const contexts = useData(s => s.contexts);
  const pomodoro = useData(s => s.pomodoro);
  const settings = useData(s => s.settings);
  // The task the palette acts on: the one focused on the board, else the one open in the sheet.
  const focusedId = useUi(s => (open ? s.focusedTaskId ?? s.task : null));
  const focused = focusedId !== null ? tasks[focusedId] : undefined;
  const recent = useMemo(() => Object.values(tasks).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200), [tasks]);

  const run = (action: () => unknown) => () => {
    setOpen(false);
    void action();
  };
  const showOn = (field: 'project' | 'context', id: number) => run(() => {
    filterBoard(field, id);
    navigate('board');
  });
  const toggleColumn = (status: TaskStatus) => run(() => setColumnVisible(status, !getSettings().visibleColumns.includes(status)));

  return <CommandDialog open={open} onOpenChange={setOpen} title="Search tasks and commands">
    <Command label="Search tasks and commands">
      <CommandInput placeholder="Search tasks and commands"/>
      <CommandList>
        <CommandEmpty/>
        {focused && <CommandGroup heading={taskKey(focused.seq)}>
          <CommandItem value={`Focus on ${focused.title}`} keywords={['start', 'pause', 'pomodoro', 'timer']} onSelect={run(() => toggleFocus(focused.id))}>
            <CommandLabel>{`Start or pause focus on ${taskKey(focused.seq)}`}</CommandLabel><CommandShortcut keys={['T']}/>
          </CommandItem>
          {STATUSES.filter(s => s !== focused.status).map(s => <CommandItem key={s} value={`Move ${taskKey(focused.seq)} to ${statusLabel[s]}`} keywords={['status']}
            onSelect={run(() => updateTask(focused.id, {status: s}))}>
            <CommandLabel>{`Move to ${statusLabel[s]}`}</CommandLabel><CommandShortcut keys={[String(STATUSES.indexOf(s) + 1)]}/>
          </CommandItem>)}
          <CommandItem value={`Copy ${taskKey(focused.seq)}`} keywords={['id']} onSelect={run(() => copyTaskKey(focused.id))}>
            <CommandLabel>Copy task ID</CommandLabel><CommandShortcut keys={['⇧', '⌘', 'C']}/>
          </CommandItem>
          <CommandItem value={`Delete ${taskKey(focused.seq)}`} keywords={['remove']} onSelect={run(() => deleteTask(focused.id))}>
            <CommandLabel>Delete task</CommandLabel><CommandShortcut keys={['⌫']}/>
          </CommandItem>
        </CommandGroup>}

        <CommandGroup heading="Tasks">
          {recent.map(t => <CommandItem key={t.id} value={`${taskKey(t.seq)} ${t.title}`} onSelect={run(() => navigate(useUi.getState().view, t.id))}>
            <CommandLabel>{t.title}</CommandLabel>
            <span className="ms-auto shrink-0 type-code-xs text-text-2">{taskKey(t.seq)}</span>
          </CommandItem>)}
        </CommandGroup>

        <CommandGroup heading="Create">
          <CommandItem value="Create task" keywords={['new', 'add', 'issue']} onSelect={run(() => useUi.getState().openNewTask())}>
            <CommandLabel>Create task</CommandLabel><CommandShortcut keys={['C']}/>
          </CommandItem>
          <CommandItem value="Create project" keywords={['new', 'add']} onSelect={run(() => useUi.getState().setProjectDialogOpen(true))}>
            <CommandLabel>Create project</CommandLabel>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          {GO_TO.map(g => <CommandItem key={g.view} value={g.label} onSelect={run(() => navigate(g.view))}>
            <CommandLabel>{g.label}</CommandLabel><CommandShortcut keys={g.keys}/>
          </CommandItem>)}
          {projects.filter(p => p.completedAt === null).map(p => <CommandItem key={`p${p.id}`} value={`Show project ${p.name}`} keywords={['project']} onSelect={showOn('project', p.id)}>
            <CommandLabel>{`Show project ${p.name}`}</CommandLabel>
          </CommandItem>)}
          {contexts.map(c => <CommandItem key={`c${c.id}`} value={`Show context ${c.name}`} keywords={['context']} onSelect={showOn('context', c.id)}>
            <CommandLabel>{`Show context ${c.name}`}</CommandLabel>
          </CommandItem>)}
        </CommandGroup>

        <CommandGroup heading="Focus timer">
          {pomodoro?.status === 'running' && <CommandItem value="Pause timer" keywords={['pomodoro', 'focus']} onSelect={run(timer.pause)}>
            <CommandLabel>Pause timer</CommandLabel>
          </CommandItem>}
          {pomodoro?.status !== 'running' && <CommandItem value={pomodoro?.status === 'paused' ? 'Resume timer' : 'Start timer'} keywords={['pomodoro', 'focus']}
            onSelect={run(() => (pomodoro?.status === 'paused' ? timer.resume() : timer.start()))}>
            <CommandLabel>{pomodoro?.status === 'paused' ? 'Resume timer' : 'Start timer'}</CommandLabel>
          </CommandItem>}
          <CommandItem value={pomodoro?.phase === 'focus' ? 'Skip to break' : 'Skip to focus'} keywords={['pomodoro', 'timer']} onSelect={run(timer.skip)}>
            <CommandLabel>{pomodoro?.phase === 'focus' ? 'Skip to break' : 'Skip to focus'}</CommandLabel>
          </CommandItem>
          {pomodoro?.status !== 'idle' && <CommandItem value="Stop session" keywords={['pomodoro', 'reset', 'timer']} onSelect={run(timer.reset)}>
            <CommandLabel>Stop session</CommandLabel>
          </CommandItem>}
        </CommandGroup>

        <CommandGroup heading="View">
          {STATUSES.map(s => {
            const shown = settings?.visibleColumns.includes(s);
            const label = `${shown ? 'Hide' : 'Show'} the ${statusLabel[s]} column`;
            return <CommandItem key={s} value={label} keywords={['column', 'board']} onSelect={toggleColumn(s)}><CommandLabel>{label}</CommandLabel></CommandItem>;
          })}
          <CommandItem value="Toggle sidebar" keywords={['hide', 'show']} onSelect={run(() => updateSettings({sidebarCollapsed: !getSettings().sidebarCollapsed}))}>
            <CommandLabel>Show or hide the sidebar</CommandLabel><CommandShortcut keys={['[']}/>
          </CommandItem>
          {(['system', 'light', 'dark'] as const).filter(t => t !== settings?.theme).map(t => <CommandItem key={t} value={`Use ${t} theme`} keywords={['appearance', 'theme', 'mode']}
            onSelect={run(() => updateSettings({theme: t}))}>
            <CommandLabel>{t === 'system' ? 'Match the system theme' : `Use the ${t} theme`}</CommandLabel>
          </CommandItem>)}
        </CommandGroup>

        <CommandGroup heading="App">
          <CommandItem value="Open settings" keywords={['preferences']} onSelect={run(() => useUi.getState().openSettings())}>
            <CommandLabel>Open settings</CommandLabel><CommandShortcut keys={['⌘', ',']}/>
          </CommandItem>
          <CommandItem value="Show keyboard shortcuts" keywords={['keys', 'help']} onSelect={run(() => useUi.getState().openSettings('shortcuts'))}>
            <CommandLabel>Show keyboard shortcuts</CommandLabel>
          </CommandItem>
          <CommandItem value="Undo last change" keywords={['revert']} onSelect={run(undoLast)}>
            <CommandLabel>Undo last change</CommandLabel><CommandShortcut keys={['⌘', 'Z']}/>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
    <CommandFooter>
      <CommandHint keys={['↑', '↓']}>to move</CommandHint>
      <CommandHint keys={['↵']}>to run</CommandHint>
      <CommandHint keys={['esc']}>to close</CommandHint>
    </CommandFooter>
  </CommandDialog>;
}
