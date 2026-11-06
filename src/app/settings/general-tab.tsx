import {Field, FieldGroup, FieldLabel} from '@/components/glaze/ui/field';
import {SegmentedControl, SegmentedControlItem} from '@/components/glaze/ui/segmented-control';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/glaze/ui/select';
import type {Theme} from '@/lib/domain/types';
import {updateSettings} from '@/lib/store/actions';
import {useSettings} from '@/lib/store/data';
import {ShortcutRecorder} from './shortcut-recorder';

export function GeneralTab() {
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
