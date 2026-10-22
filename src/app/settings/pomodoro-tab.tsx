import {FieldGroup} from '@/components/glaze/ui/field';
import {NumberSetting, SwitchSetting} from './setting-rows';

export function PomodoroTab() {
  return <FieldGroup>
    <NumberSetting label="Focus" setting="focusMinutes" min={1} max={90}/>
    <NumberSetting label="Short break" setting="shortBreakMinutes" min={1} max={30}/>
    <NumberSetting label="Long break" setting="longBreakMinutes" min={1} max={60}/>
    <NumberSetting label="Long break after" setting="longBreakEvery" min={2} max={8} unit="sessions"/>
    <SwitchSetting label="Start breaks automatically" setting="autoStartBreaks"/>
    <SwitchSetting label="Start focus automatically" description="After a break, the next focus session starts on its own." setting="autoStartFocus"/>
    <SwitchSetting label="Move the task to In progress" description="When a focus session starts on a task in Backlog or Todo." setting="moveToInProgress"/>
    <SwitchSetting label="Play a sound" description="A chime when a session or a break ends." setting="soundEnabled"/>
    <SwitchSetting label="Show the time in the menu bar" setting="showTimeInMenuBar"/>
  </FieldGroup>;
}
