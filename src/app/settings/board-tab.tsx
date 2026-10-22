import {Field, FieldContent, FieldDescription, FieldGroup, FieldLabel} from '@/components/glaze/ui/field';
import {ColumnSwitches, CompletedWindow} from '@/app/board/display-options';
import {NumberSetting, SwitchSetting} from './setting-rows';

export function BoardTab() {
  return <FieldGroup>
    <ColumnSwitches/>
    <SwitchSetting label="Show empty columns" setting="showEmptyColumns"/>
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel>Done and cancelled</FieldLabel>
        <FieldDescription>Older tasks stay a click away at the bottom of the column.</FieldDescription>
      </FieldContent>
      <CompletedWindow/>
    </Field>
    <NumberSetting label="In progress limit" setting="wipLimit" min={0} max={20} unit="tasks"/>
    <p className="-mt-2 type-caption text-text-2">The In progress column says when it holds more than this. 0 turns it off.</p>
    <NumberSetting label="Stalled after" setting="stalledDays" min={3} max={30} unit="days"/>
    <p className="-mt-2 type-caption text-text-2">Todo and In progress tasks with no activity this long come up in the weekly review.</p>
  </FieldGroup>;
}
