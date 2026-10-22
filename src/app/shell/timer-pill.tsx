import {useEffect, useState} from 'react';
import {Break, Focus, Icon, Pause} from '@/components/glaze/icon';
import {Button} from '@/components/glaze/ui/button';
import {Popover, PopoverClose, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger} from '@/components/glaze/ui/popover';
import {Progress, ProgressLabel, ProgressValue} from '@/components/glaze/ui/progress';
import {startOfToday} from '@/lib/domain/dates';
import {taskKey} from '@/lib/domain/status';
import {timer} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';
import {commands} from '@/lib/tauri/commands';
import {clock, phaseLabel, useCountdown} from './use-countdown';

/** The running session in the header: the time left, and a popover to pause or stop it. Hidden while the timer waits. */
export function TimerPill() {
  const pomodoro = useData(s => s.pomodoro);
  const left = useCountdown(pomodoro);
  const [open, setOpen] = useState(false);
  const [doneToday, setDoneToday] = useState<number | null>(null);

  useEffect(() => {
    if (open) void commands.focusSessionsSince(startOfToday()).then(setDoneToday);
  }, [open]);

  if (!pomodoro || pomodoro.status === 'idle') return null;
  const onBreak = pomodoro.phase !== 'focus';
  const paused = pomodoro.status === 'paused';
  const elapsedMinutes = Math.floor((pomodoro.plannedMs - left) / 60_000);
  const plannedMinutes = Math.round(pomodoro.plannedMs / 60_000);
  const title = pomodoro.task && !onBreak ? `Focus on ${taskKey(pomodoro.task.seq)}` : phaseLabel[pomodoro.phase];

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button variant="secondary" size="sm" aria-label={`${phaseLabel[pomodoro.phase]}, ${clock(left)} left${paused ? ', paused' : ''}`}/>}>
      <Icon icon={paused ? Pause : onBreak ? Break : Focus}/>
      <span className="data">{clock(left)}</span>
      {pomodoro.task && !onBreak && <span className="mono text-text-2">{taskKey(pomodoro.task.seq)}</span>}
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72">
      <PopoverHeader>
        <PopoverTitle>{title}</PopoverTitle>
        {pomodoro.task && !onBreak && <PopoverDescription>{pomodoro.task.title}</PopoverDescription>}
      </PopoverHeader>
      <Progress value={Math.max(0, pomodoro.plannedMs - left)} max={pomodoro.plannedMs} size="sm">
        <ProgressLabel>{paused ? `${phaseLabel[pomodoro.phase]}, paused` : phaseLabel[pomodoro.phase]}</ProgressLabel>
        <ProgressValue>{() => `${elapsedMinutes} of ${plannedMinutes} min`}</ProgressValue>
      </Progress>
      {doneToday !== null && <p className="type-caption text-text-2">
        {doneToday === 1 ? '1 focus session today' : `${doneToday} focus sessions today`}
      </p>}
      <div className="flex justify-end gap-2">
        <PopoverClose render={<Button variant="secondary" size="sm" onClick={() => void timer.reset()}/>}>Stop session</PopoverClose>
        {paused
          ? <Button size="sm" onClick={() => void timer.resume()}>Resume</Button>
          : <Button size="sm" onClick={() => void timer.pause()}>Pause</Button>}
      </div>
    </PopoverContent>
  </Popover>;
}
