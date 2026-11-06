import {useEffect, useState} from 'react';
import type {PomodoroSnapshot} from '@/lib/domain/types';

/** The time left in the session, counted down locally from Rust's end time. Rust stays the clock; this only draws it. */
export function useCountdown(pomodoro: PomodoroSnapshot | null): number {
  const [now, setNow] = useState(Date.now);
  const running = pomodoro?.status === 'running' && pomodoro.endsAt !== null;
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running, pomodoro?.endsAt]);
  if (!pomodoro) return 0;
  return running ? Math.max(0, pomodoro.endsAt! - now) : pomodoro.remainingMs;
}

/** 24:13, counting a started second as a whole one, the way the menu bar shows it. */
export function clock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export const phaseLabel = {focus: 'Focus', short_break: 'Short break', long_break: 'Long break'} as const;
