import {useState} from 'react';
import {Add, Check, Context as ContextIcon, Icon, Project as ProjectIcon} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandLabel, CommandList} from '@/components/glaze/ui/command';
import {DatePicker} from '@/components/glaze/ui/date-picker';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/glaze/ui/dropdown-menu';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/glaze/ui/popover';
import {StatusMark} from '@/components/glaze/ui/status';
import {fromDay, toDay} from '@/lib/domain/dates';
import {PRIORITIES, priorityLabel} from '@/lib/domain/priority';
import {STATUSES, statusLabel, statusTone} from '@/lib/domain/status';
import type {Priority, TaskStatus} from '@/lib/domain/types';
import {createContext, createProject} from '@/lib/store/actions';
import {useData, useSettings} from '@/lib/store/data';
import {priorityIcon} from './task-marks';

type Size = 'sm' | 'default';

export function StatusPicker({value, onChange, size = 'sm'}: {value: TaskStatus; onChange: (s: TaskStatus) => void; size?: Size}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="secondary" size={size} aria-label={`Status: ${statusLabel[value]}`}/>}>
      {/* The arc stays still here: it turns only for the session being timed. */}
      <span data-force-reduced-motion="" className="contents"><StatusMark status={statusTone[value]}/></span>
      {statusLabel[value]}
    </DropdownMenuTrigger>
    <DropdownMenuContent size="sm">
      <DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as TaskStatus)}>
        {STATUSES.map((s, i) => <DropdownMenuRadioItem key={s} value={s} closeOnClick>
          {statusLabel[s]}<DropdownMenuShortcut keys={[String(i + 1)]}/>
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function PriorityPicker({value, onChange, size = 'sm'}: {value: Priority; onChange: (p: Priority) => void; size?: Size}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="secondary" size={size} aria-label={`Priority: ${priorityLabel[value]}`}/>}>
      <Icon icon={priorityIcon[value]}/>
      {value === 0 ? 'Priority' : priorityLabel[value]}
    </DropdownMenuTrigger>
    <DropdownMenuContent size="sm">
      <DropdownMenuRadioGroup value={String(value)} onValueChange={v => onChange(Number(v) as Priority)}>
        {PRIORITIES.map(p => <DropdownMenuRadioItem key={p} value={String(p)} closeOnClick>{priorityLabel[p]}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Picks one project by typing, and makes a new one when nothing matches. */
export function ProjectPicker({value, onChange, size = 'sm'}: {value: number | null; onChange: (id: number | null) => void; size?: Size}) {
  const projects = useData(s => s.projects);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = projects.find(p => p.id === value);
  const name = query.trim();
  const exact = projects.some(p => p.name.toLowerCase() === name.toLowerCase());
  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button variant="secondary" size={size} aria-label={`Project: ${current?.name ?? 'none'}`}/>}>
      <Icon icon={ProjectIcon}/>{current?.name ?? 'Project'}
    </PopoverTrigger>
    <PopoverContent align="start" className="w-64 gap-0 p-0">
      <Command label="Projects">
        <CommandInput placeholder="Find or create a project" value={query} onValueChange={setQuery}/>
        <CommandList>
          <CommandEmpty>No projects match</CommandEmpty>
          <CommandGroup>
            <CommandItem value="No project" onSelect={() => pick(null)}>
              <CommandLabel>No project</CommandLabel>{value === null && <Icon icon={Check} className="ms-auto"/>}
            </CommandItem>
            {projects.filter(p => p.completedAt === null || p.id === value).map(p =>
              <CommandItem key={p.id} value={p.name} onSelect={() => pick(p.id)}>
                <CommandLabel>{p.name}</CommandLabel>{p.id === value && <Icon icon={Check} className="ms-auto"/>}
              </CommandItem>)}
            {name && !exact && <CommandItem forceMount value={`Create project ${name}`} onSelect={async () => {
              const project = await createProject(name);
              if (project) pick(project.id);
            }}>
              <Icon icon={Add}/><CommandLabel>{`Create project “${name}”`}</CommandLabel>
            </CommandItem>}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}

/** Picks any number of contexts; the list stays open while you tick them. */
export function ContextsPicker({value, onChange, size = 'sm'}: {value: number[]; onChange: (ids: number[]) => void; size?: Size}) {
  const contexts = useData(s => s.contexts);
  const [query, setQuery] = useState('');
  const chosen = contexts.filter(c => value.includes(c.id));
  const name = query.trim().replace(/^@/, '');
  const exact = contexts.some(c => c.name.slice(1).toLowerCase() === name.toLowerCase().replace(/\s+/g, '-'));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  const label = chosen.length === 0 ? 'Contexts' : chosen.length <= 2 ? chosen.map(c => c.name).join(', ') : `${chosen.length} contexts`;

  return <Popover onOpenChange={open => { if (!open) setQuery(''); }}>
    <PopoverTrigger render={<Button variant="secondary" size={size} aria-label={`Contexts: ${chosen.map(c => c.name).join(', ') || 'none'}`}/>}>
      <Icon icon={ContextIcon}/>{label}
    </PopoverTrigger>
    <PopoverContent align="start" className="w-64 gap-0 p-0">
      <Command label="Contexts">
        <CommandInput placeholder="Find or create a context" value={query} onValueChange={setQuery}/>
        <CommandList aria-multiselectable="true">
          <CommandEmpty>No contexts match</CommandEmpty>
          <CommandGroup>
            {contexts.map(c => <CommandItem key={c.id} value={c.name} aria-checked={value.includes(c.id)} onSelect={() => toggle(c.id)}>
              <CommandLabel>{c.name}</CommandLabel>{value.includes(c.id) && <Icon icon={Check} className="ms-auto"/>}
            </CommandItem>)}
            {name && !exact && <CommandItem forceMount value={`Create context ${name}`} onSelect={async () => {
              const context = await createContext(name);
              if (context) {
                onChange([...value, context.id]);
                setQuery('');
              }
            }}>
              <Icon icon={Add}/><CommandLabel>{`Create context @${name.toLowerCase().replace(/\s+/g, '-')}`}</CommandLabel>
            </CommandItem>}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}

export function DuePicker({value, onChange, size = 'sm'}: {value: string | null; onChange: (day: string | null) => void; size?: Size}) {
  const {weekStartsOn} = useSettings();
  return <DatePicker
    size={size}
    className="w-40"
    clearable
    aria-label="Due date"
    placeholder="Due date"
    weekStartsOn={weekStartsOn}
    locale={navigator.language}
    value={value ? fromDay(value) : null}
    onValueChange={(date: Date | null) => onChange(date ? toDay(date) : null)}
  />;
}
