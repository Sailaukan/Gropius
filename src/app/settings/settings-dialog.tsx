import {useState} from 'react';
import {Icon, More} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {DataList, DataListItem, DataListLabel, DataListValue} from '@/components/glaze/ui/data-list';
import {Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/glaze/ui/dialog';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from '@/components/glaze/ui/dropdown-menu';
import {Field, FieldContent, FieldDescription, FieldGroup, FieldLabel} from '@/components/glaze/ui/field';
import {Input} from '@/components/glaze/ui/input';
import {Item, ItemActions, ItemContent, ItemGroup, ItemMeta, ItemTitle} from '@/components/glaze/ui/item';
import {Kbd} from '@/components/glaze/ui/kbd';
import {NumberInput} from '@/components/glaze/ui/number-input';
import {SegmentedControl, SegmentedControlItem} from '@/components/glaze/ui/segmented-control';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/glaze/ui/select';
import {Switch} from '@/components/glaze/ui/switch';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/glaze/ui/tabs';
import type {Settings, Theme} from '@/lib/domain/types';
import {createContext, deleteContext, renameContext, updateSettings} from '@/lib/store/actions';
import {useData, useSettings} from '@/lib/store/data';
import {useUi, type SettingsTab} from '@/lib/store/ui';
import {ColumnSwitches, CompletedWindow} from '@/app/board/display-options';
import {KEYMAP} from '@/app/keyboard/keymap';
import {ShortcutRecorder} from './shortcut-recorder';

export function SettingsDialog() {
  const {open, tab} = useUi(s => s.settings);
  const close = useUi(s => s.closeSettings);
  const setTab = useUi(s => s.setSettingsTab);

  return <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
    <DialogContent size="lg" className="h-[min(42rem,calc(100dvh-var(--space-10)))]">
      <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>
      <Tabs value={tab} onValueChange={value => setTab(value as SettingsTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="px-4"><TabsList aria-label="Settings">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
          <TabsTrigger value="contexts">Contexts</TabsTrigger>
          <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
        </TabsList></div>
        <DialogBody>
          <TabsContent value="general" keepMounted><GeneralTab/></TabsContent>
          <TabsContent value="board" keepMounted><BoardTab/></TabsContent>
          <TabsContent value="pomodoro" keepMounted><PomodoroTab/></TabsContent>
          <TabsContent value="contexts" keepMounted><ContextsTab/></TabsContent>
          <TabsContent value="shortcuts"><ShortcutsTab/></TabsContent>
        </DialogBody>
      </Tabs>
      <DialogFooter meta="Changes save as you make them." defaultAction="dismiss">
        <DialogClose>Close</DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

/** A setting that turns on or off, with a line saying what it does. */
function Toggle({label, description, setting}: {label: string; description?: string; setting: keyof Settings}) {
  const settings = useSettings();
  return <Field orientation="horizontal">
    <FieldContent>
      <FieldLabel>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
    </FieldContent>
    <Switch checked={Boolean(settings[setting])} onCheckedChange={on => void updateSettings({[setting]: on})}/>
  </Field>;
}

function Minutes({label, setting, min, max, unit = 'min'}: {label: string; setting: keyof Settings; min: number; max: number; unit?: string}) {
  const settings = useSettings();
  return <Field orientation="horizontal">
    <FieldLabel className="flex-1">{label}</FieldLabel>
    <NumberInput
      className="w-36"
      min={min}
      max={max}
      unit={unit}
      value={settings[setting] as number}
      onValueChange={value => { if (value !== null && value >= min && value <= max) void updateSettings({[setting]: value}); }}
    />
  </Field>;
}

function GeneralTab() {
  const settings = useSettings();
  return <FieldGroup>
    <Field orientation="horizontal">
      <FieldLabel className="flex-1">Theme</FieldLabel>
      <SegmentedControl aria-label="Theme" value={settings.theme} onValueChange={value => void updateSettings({theme: value as Theme})}>
        <SegmentedControlItem value="system">System</SegmentedControlItem>
        <SegmentedControlItem value="light">Light</SegmentedControlItem>
        <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
      </SegmentedControl>
    </Field>
    <ShortcutRecorder/>
    <Field orientation="horizontal">
      <FieldLabel className="flex-1">Week starts on</FieldLabel>
      <Select
        items={[{value: '1', label: 'Monday'}, {value: '0', label: 'Sunday'}]}
        value={String(settings.weekStartsOn)}
        onValueChange={value => void updateSettings({weekStartsOn: Number(value) as 0 | 1})}
      >
        <SelectTrigger className="w-40 shrink-0"><SelectValue/></SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Monday</SelectItem>
          <SelectItem value="0">Sunday</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </FieldGroup>;
}

function BoardTab() {
  return <FieldGroup>
    <ColumnSwitches/>
    <Toggle label="Show empty columns" setting="showEmptyColumns"/>
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel>Done and cancelled</FieldLabel>
        <FieldDescription>Older tasks stay a click away at the bottom of the column.</FieldDescription>
      </FieldContent>
      <CompletedWindow/>
    </Field>
    <Minutes label="In progress limit" setting="wipLimit" min={0} max={20} unit="tasks"/>
    <p className="-mt-2 type-caption text-text-2">The In progress column says when it holds more than this. 0 turns it off.</p>
    <Minutes label="Stalled after" setting="stalledDays" min={3} max={30} unit="days"/>
    <p className="-mt-2 type-caption text-text-2">Todo and In progress tasks with no activity this long come up in the weekly review.</p>
  </FieldGroup>;
}

function PomodoroTab() {
  return <FieldGroup>
    <Minutes label="Focus" setting="focusMinutes" min={1} max={90}/>
    <Minutes label="Short break" setting="shortBreakMinutes" min={1} max={30}/>
    <Minutes label="Long break" setting="longBreakMinutes" min={1} max={60}/>
    <Minutes label="Long break after" setting="longBreakEvery" min={2} max={8} unit="sessions"/>
    <Toggle label="Start breaks automatically" setting="autoStartBreaks"/>
    <Toggle label="Start focus automatically" description="After a break, the next focus session starts on its own." setting="autoStartFocus"/>
    <Toggle label="Move the task to In progress" description="When a focus session starts on a task in Backlog or Todo." setting="moveToInProgress"/>
    <Toggle label="Play a sound" description="A chime when a session or a break ends." setting="soundEnabled"/>
    <Toggle label="Show the time in the menu bar" setting="showTimeInMenuBar"/>
  </FieldGroup>;
}

function ContextsTab() {
  const contexts = useData(s => s.contexts);
  const tasks = useData(s => s.tasks);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const count = (id: number) => Object.values(tasks).filter(t => t.contextIds.includes(id)).length;

  const add = async () => {
    if (name.trim() && await createContext(name)) setName('');
  };
  const rename = async (id: number) => {
    if (draft.trim() && await renameContext(id, draft)) setRenaming(null);
  };

  return <div className="flex flex-col gap-4">
    <p className="type-body-sm text-text-2">Contexts say where or with what a task can be done, such as @calls or @errands. Filter the board by one to see only what you can do now.</p>
    <ItemGroup aria-label="Contexts">
      {contexts.map(c => <Item key={c.id}>
        <ItemContent>
          {renaming === c.id
            ? <Input
              size="sm"
              aria-label={`New name for ${c.name}`}
              value={draft}
              autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={() => setRenaming(null)}
              onKeyDown={e => {
                if (e.key === 'Enter') void rename(c.id);
                if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); }
              }}
            />
            : <ItemTitle><span>{c.name}</span></ItemTitle>}
        </ItemContent>
        <ItemMeta>{count(c.id) === 1 ? '1 task' : `${count(c.id)} tasks`}</ItemMeta>
        <ItemActions>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}/>}>
              <Icon icon={More}/>
            </DropdownMenuTrigger>
            <DropdownMenuContent size="sm" align="end">
              <DropdownMenuItem onClick={() => { setDraft(c.name); setRenaming(c.id); }}>Rename context</DropdownMenuItem>
              <DropdownMenuSeparator/>
              <DropdownMenuItem variant="destructive" onClick={() => void deleteContext(c.id)}>Delete context</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>)}
    </ItemGroup>
    <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); void add(); }}>
      <Input aria-label="New context" placeholder="@reading" value={name} onChange={e => setName(e.target.value)} className="flex-1"/>
      <Button type="submit" variant="secondary">Add context</Button>
    </form>
  </div>;
}

function ShortcutsTab() {
  return <div className="flex flex-col gap-6">
    {KEYMAP.map(group => <section key={group.title} aria-labelledby={`keys-${group.title}`} className="flex flex-col gap-2">
      <h3 id={`keys-${group.title}`} className="type-label-sm text-text-2">{group.title}</h3>
      <DataList variant="panel">
        {group.shortcuts.map(s => <DataListItem key={s.keys + s.label}>
          <DataListLabel>{s.label}</DataListLabel>
          <DataListValue><Kbd keys={s.keys}/></DataListValue>
        </DataListItem>)}
      </DataList>
    </section>)}
  </div>;
}
