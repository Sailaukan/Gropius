import {Display, Icon} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {Field, FieldLabel} from '@/components/glaze/ui/field';
import {Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger} from '@/components/glaze/ui/popover';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/glaze/ui/select';
import {Switch} from '@/components/glaze/ui/switch';
import {STATUSES, statusLabel} from '@/lib/domain/status';
import {setColumnVisible, updateSettings} from '@/lib/store/actions';
import {useSettings} from '@/lib/store/data';

const COMPLETED_WINDOWS = [
  {value: '7', label: 'Last 7 days'},
  {value: '14', label: 'Last 14 days'},
  {value: '30', label: 'Last 30 days'},
  {value: 'all', label: 'All'},
];

/** Which columns show, kept in the settings. At least one column always stays. */
export function ColumnSwitches() {
  const {visibleColumns} = useSettings();
  return <div role="group" aria-labelledby="columns-label" className="flex flex-col gap-2">
    <p id="columns-label" className="type-label-sm text-text-2">Columns</p>
    {STATUSES.map(status => {
      const on = visibleColumns.includes(status);
      return <Field key={status} orientation="horizontal">
        <FieldLabel>{statusLabel[status]}</FieldLabel>
        <Switch size="sm" checked={on} disabled={on && visibleColumns.length === 1} onCheckedChange={next => setColumnVisible(status, next)}/>
      </Field>;
    })}
  </div>;
}

/** Beside its label the trigger keeps a fixed width; stacked under it, pass full to fill the row. */
export function CompletedWindow({size = 'default', full = false}: {size?: 'sm' | 'default'; full?: boolean}) {
  const {completedDays} = useSettings();
  return <Select
    items={COMPLETED_WINDOWS}
    value={completedDays === null ? 'all' : String(completedDays)}
    onValueChange={value => void updateSettings({completedDays: value === 'all' || value === null ? null : Number(value)})}
  >
    {/* The trigger fills its row by default, which would squeeze a label beside it. */}
    <SelectTrigger size={size} aria-label="Done and cancelled tasks to show" className={full ? 'w-full' : 'w-40 shrink-0'}><SelectValue/></SelectTrigger>
    <SelectContent size={size}>
      {COMPLETED_WINDOWS.map(w => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}

/** The board's view settings, as in Linear's Display menu. */
export function DisplayOptions() {
  const {showEmptyColumns} = useSettings();
  return <Popover>
    <PopoverTrigger render={<Button variant="secondary" size="sm"/>}>
      <Icon icon={Display}/>Display
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72">
      <PopoverHeader><PopoverTitle>Display</PopoverTitle></PopoverHeader>
      <ColumnSwitches/>
      <div className="flex flex-col gap-2 border-t border-line-faint pt-3">
        <Field orientation="horizontal">
          <FieldLabel>Show empty columns</FieldLabel>
          <Switch size="sm" checked={showEmptyColumns} onCheckedChange={on => void updateSettings({showEmptyColumns: on})}/>
        </Field>
        <Field>
          <FieldLabel>Done and cancelled</FieldLabel>
          <CompletedWindow size="sm" full/>
        </Field>
      </div>
    </PopoverContent>
  </Popover>;
}
