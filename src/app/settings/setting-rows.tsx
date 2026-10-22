import {Field, FieldContent, FieldDescription, FieldLabel} from '@/components/glaze/ui/field';
import {NumberInput} from '@/components/glaze/ui/number-input';
import {Switch} from '@/components/glaze/ui/switch';
import type {Settings} from '@/lib/domain/types';
import {updateSettings} from '@/lib/store/actions';
import {useSettings} from '@/lib/store/data';

/** A setting that turns on or off, with a line saying what it does. */
export function SwitchSetting({label, description, setting}: {label: string; description?: string; setting: keyof Settings}) {
  const settings = useSettings();
  return <Field orientation="horizontal">
    <FieldContent>
      <FieldLabel>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
    </FieldContent>
    <Switch checked={Boolean(settings[setting])} onCheckedChange={on => void updateSettings({[setting]: on})}/>
  </Field>;
}

/** A number in a range, such as minutes, days or tasks, saved as soon as it is valid. */
export function NumberSetting({label, setting, min, max, unit = 'min'}: {label: string; setting: keyof Settings; min: number; max: number; unit?: string}) {
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
