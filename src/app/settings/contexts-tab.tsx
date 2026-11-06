import {useState} from 'react';
import {Icon, More} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from '@/components/glaze/ui/dropdown-menu';
import {Input} from '@/components/glaze/ui/input';
import {Item, ItemActions, ItemContent, ItemGroup, ItemMeta, ItemTitle} from '@/components/glaze/ui/item';
import {createContext, deleteContext, renameContext} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';

export function ContextsTab() {
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
