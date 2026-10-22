import {DataList, DataListItem, DataListLabel, DataListValue} from '@/components/glaze/ui/data-list';
import {Kbd} from '@/components/glaze/ui/kbd';
import {KEYMAP} from '@/app/keyboard/keymap';

export function ShortcutsTab() {
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
