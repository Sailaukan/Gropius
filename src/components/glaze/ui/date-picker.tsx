'use client';

import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {Popover as PopoverPrimitive} from '@base-ui/react/popover';
import {Icon, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, ChevronSort, Time} from '@/components/glaze/icon';
import {menuItemClass, menuPopupClass, overlayMotion, overlayPanel, overlayShell} from '@/lib/glaze/overlay';
import {useGlazePortal} from '@/lib/glaze/portal';
import {cn} from '@/lib/glaze/utils';
import {Button} from '@/components/glaze/ui/button';
import {useFieldDisabled} from '@/components/glaze/ui/field';
import {InputAction, InputControl, InputRoot, InputTrailing, type InputSize} from '@/components/glaze/ui/input';
import {fieldTriggerClass, fieldTriggerSize} from '@/components/glaze/ui/select';

// Glaze's date picker: a date, a range, a date and time, or a time of day.
//
//   granularity="date"      the field pill as a button that opens the Calendar. One date closes on the pick; a range
//                           closes once both ends are picked and can offer presets beside the calendar
//   granularity="datetime"  the Calendar with a time field under it, written with Set
//   granularity="time"      Input's pill that reads "930", "9:30pm" or "21", with a list of times every `step`
//
// The trigger is Select's: the field pill, a calendar icon in text-3, the value, and the caret. The popup holds a
// calendar and actions, so it nests like the card: the grey shell, the white panel 3px in holding the presets and the
// month grid, and a footer row on the shell with the range's day count as meta and Clear and Set as small actions.
//
// A day is a 32px round cell. The picked day, and each end of a range, takes small glaze (glaze-sm), the value
// chosen, like a ticked box. The days between take the selected wash (ink at 10%) as one band whose ends
// round with the cells. Today is underlined with a short hairline, never a dot or a ring. A day that cannot be picked is struck through.
//
// No date library: plain Date objects at local midnight and Intl for names. The Calendar is an ARIA grid with one tab
// stop; arrows move by day and week (mirrored in right to left), Page keys by month, Shift+Page by year, Home and End
// to the week's ends, and a run of disabled days is crossed, never parked on. A range counts its days while you pick,
// inclusively and in calendar days, so a week across a daylight-saving change still reads 7.

// ---------- date helpers, local time ----------

type DateRange = {from?: Date; to?: Date};
type Matcher = ((date: Date) => boolean) | {before?: Date; after?: Date};

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** Today's UTC date as a local midnight: the same first render on the server and in every zone. */
const utcToday = () => { const d = new Date(); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const same = (a?: Date | null, b?: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Calendar days from a to b, both counted, on UTC dates, so daylight saving never shaves an hour off. */
function daysBetween(a: Date, b: Date) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.abs(Math.round((ub - ua) / 86_400_000)) + 1;
}
const dayCount = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'day' : 'days'}`;

function isDisabled(date: Date, matcher?: Matcher) {
  if (!matcher) return false;
  if (typeof matcher === 'function') return matcher(date);
  if (matcher.before && date < day(matcher.before)) return true;
  if (matcher.after && date > day(matcher.after)) return true;
  return false;
}

/** Six weeks from weekStartsOn, so the grid never changes height between months. */
function weeksOf(month: Date, weekStartsOn: number) {
  const first = monthStart(month);
  const start = addDays(first, -((first.getDay() - weekStartsOn + 7) % 7));
  return Array.from({length: 6}, (_, w) => Array.from({length: 7}, (_, d) => addDays(start, w * 7 + d)));
}

// ---------- Calendar ----------

type CalendarBaseProps = {
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Days that cannot be picked: a function, or limits like {before: today}. */
  disabled?: Matcher;
  /** 0 is Sunday, 1 is Monday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** One month, or two side by side for a range. */
  numberOfMonths?: 1 | 2;
  /** Days from the months either side fill the grid in text-3. */
  showOutsideDays?: boolean;
  /** BCP 47 locale for month and weekday names. */
  locale?: string;
  /** Focus the picked day (or today) on mount, as inside the picker's popup. */
  autoFocus?: boolean;
  /** Pin which day counts as today, for a still picture or a test. */
  today?: Date;
  /** A range: the end the pointer or the keyboard is on while the second end is open, read back for the count. */
  onPreview?: (range: {from?: Date; to?: Date}) => void;
  className?: string;
};

type CalendarSingleProps = CalendarBaseProps & {mode?: 'single'; selected?: Date | null; defaultSelected?: Date | null; onSelect?: (date: Date) => void};
type CalendarRangeProps = CalendarBaseProps & {mode: 'range'; selected?: DateRange; defaultSelected?: DateRange; onSelect?: (range: DateRange) => void};
type CalendarProps = CalendarSingleProps | CalendarRangeProps;

const dayClass = cn(
  'relative flex size-(--control) items-center justify-center rounded-pill type-label data text-text-1 outline-none [-webkit-tap-highlight-color:transparent]',
  'transition-[background-color,color] duration-(--dur-state) ease-out',
  'hover:not-disabled:not-data-selected:bg-hover focus-visible:focus-ring-inset data-selected:focus-visible:focus-ring',
  'data-outside:text-text-3',
  // Today: a 12px hairline under the number at --line-focus, the number in text-1. The picked day's glaze covers it.
  "data-today:text-text-1 data-today:after:pointer-events-none data-today:after:absolute data-today:after:bottom-1 data-today:after:left-1/2 data-today:after:h-px data-today:after:w-3 data-today:after:-translate-x-1/2 data-today:after:bg-line-focus data-today:after:content-[''] data-selected:after:hidden",
  // The picked day: small glaze, its label in the glaze's glyph colour.
  'data-selected:glaze-sm',
  'disabled:cursor-not-allowed disabled:text-text-disabled disabled:line-through disabled:decoration-1',
  'forced-colors:data-selected:border-2',
);

/** A month grid for one date or a range. The date picker's popup part; it also stands on a page alone. */
function Calendar(props: CalendarProps) {
  const {month: monthProp, defaultMonth, onMonthChange, disabled, weekStartsOn = 0, numberOfMonths = 1, showOutsideDays = true, locale = 'en-US', autoFocus, onPreview, className} = props;
  const range = props.mode === 'range';
  const [innerSelected, setInnerSelected] = useState<Date | DateRange | null | undefined>(props.defaultSelected);
  const selected = props.selected !== undefined ? props.selected : innerSelected;
  const single = range ? null : (selected as Date | null | undefined) ?? null;
  const span = range ? ((selected as DateRange | undefined) ?? {}) : {};

  // Today is read after mount, so the server and the browser agree on the first render.
  const [clock, setClock] = useState<Date | null>(null);
  const today = props.today ? day(props.today) : clock;
  const given = monthProp ?? defaultMonth ?? single ?? span.from;
  const [innerMonth, setInnerMonth] = useState(monthStart(given ?? props.today ?? utcToday()));
  const month = monthProp ? monthStart(monthProp) : innerMonth;
  const setMonth = (m: Date) => { const s = monthStart(m); if (!monthProp) setInnerMonth(s); onMonthChange?.(s); };

  const [focusDate, setFocusDate] = useState<Date>(() => day(single ?? span.from ?? monthProp ?? defaultMonth ?? props.today ?? utcToday()));
  useEffect(() => {
    const now = day(props.today ?? new Date());
    setClock(now);
    if (given) return;
    setInnerMonth(monthStart(now));
    setFocusDate(now);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [hover, setHover] = useState<Date | null>(null);
  const shouldFocus = useRef(!!autoFocus);
  const gridRef = useRef<HTMLDivElement>(null);
  const captionId = useId();

  const months = useMemo(() => Array.from({length: numberOfMonths}, (_, i) => addMonths(month, i)), [month, numberOfMonths]);
  const visible = (d: Date) => months.some(m => sameMonth(m, d));
  // The one tab stop is never a disabled day.
  const tabDate = (() => {
    const ok = (d?: Date | null): d is Date => !!d && visible(d) && !isDisabled(d, disabled);
    if (ok(focusDate)) return focusDate;
    for (const c of [single, span.from, today]) if (ok(c)) return c;
    for (const m of months) for (const week of weeksOf(m, weekStartsOn)) for (const d of week) if (sameMonth(d, m) && !isDisabled(d, disabled)) return d;
    return months[0];
  })();

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${key(tabDate)}"]`)?.focus();
  });

  const fmtMonth = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric'});
  const fmtWeekday = new Intl.DateTimeFormat(locale, {weekday: 'short'});
  const fmtWeekdayLong = new Intl.DateTimeFormat(locale, {weekday: 'long'});
  const fmtFull = new Intl.DateTimeFormat(locale, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
  const weekdays = weeksOf(month, weekStartsOn)[0];

  const choose = (date: Date) => {
    if (range) {
      const {from, to} = span;
      const next: DateRange = !from || to ? {from: date, to: undefined} : date < from ? {from: date, to: from} : {from, to: date};
      if (props.selected === undefined) setInnerSelected(next);
      (props as CalendarRangeProps).onSelect?.(next);
    } else {
      if (props.selected === undefined) setInnerSelected(date);
      (props as CalendarSingleProps).onSelect?.(date);
    }
    setFocusDate(date);
    if (!visible(date)) setMonth(date);
  };

  const move = (to: Date) => {
    setFocusDate(to);
    if (range && span.from && !span.to) setHover(to);
    shouldFocus.current = true;
    if (!visible(to)) setMonth(to < months[0] ? to : addMonths(to, -(numberOfMonths - 1)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const dow = (date.getDay() - weekStartsOn + 7) % 7;
    const rtl = !!e.currentTarget.closest('[dir=rtl]');
    // Each key lists the days it would land on, nearest first; focus goes to the first that can be picked.
    const walk = (step: (d: Date) => Date, max = 400) => { const out: Date[] = []; for (let c = step(date), i = 0; i < max; c = step(c), i++) out.push(c); return out; };
    const toward = (end: Date) => { const out: Date[] = []; const dir = end < date ? 1 : -1; for (let c = end; !same(c, date); c = addDays(c, dir)) out.push(c); return out; };
    const byMonths = (n: number) => Array.from({length: 24}, (_, i) => addMonths(date, n * (i + 1)));
    const moves: Record<string, () => Date[]> = {
      ArrowLeft: () => walk(d => addDays(d, rtl ? 1 : -1)),
      ArrowRight: () => walk(d => addDays(d, rtl ? -1 : 1)),
      ArrowUp: () => walk(d => addDays(d, -7), 60),
      ArrowDown: () => walk(d => addDays(d, 7), 60),
      Home: () => toward(addDays(date, -dow)),
      End: () => toward(addDays(date, 6 - dow)),
      PageUp: () => byMonths(e.shiftKey ? -12 : -1),
      PageDown: () => byMonths(e.shiftKey ? 12 : 1),
    };
    const fn = moves[e.key];
    if (!fn) return;
    e.preventDefault();
    const to = fn().find(d => !isDisabled(d, disabled));
    if (to) move(to);
  };

  // The range on screen: from..to, or from..the hovered or focused day while the end is open.
  const [lo, hi] = (() => {
    const from = span.from;
    const to = span.to ?? (from && hover && !isDisabled(hover, disabled) ? hover : undefined);
    if (!from) return [undefined, undefined];
    if (!to) return [from, from];
    return from <= to ? [from, to] : [to, from];
  })();
  const loKey = lo ? key(lo) : '', hiKey = hi ? key(hi) : '';
  useEffect(() => { if (range) onPreview?.({from: lo, to: hi}); }, [loKey, hiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div data-slot="calendar" data-mode={range ? 'range' : 'single'} className={cn('inline-flex w-fit max-w-full flex-col text-text-1', className)}>
    <div ref={gridRef} className="flex flex-col gap-4 sm:flex-row" onMouseLeave={() => range && setHover(null)}>
      {months.map((m, mi) => {
        const id = `${captionId}-${mi}`;
        return <div key={key(m)} data-slot="calendar-month" className="flex flex-col gap-1">
          <div className="flex h-(--control-sm) items-center justify-between gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className={cn(mi > 0 && 'invisible')}>
              <Icon icon={ChevronLeft} className="rtl:-scale-x-100"/>
            </Button>
            <div id={id} aria-live="polite" className="type-label">{fmtMonth.format(m)}</div>
            <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className={cn(mi < numberOfMonths - 1 && 'invisible')}>
              <Icon icon={ChevronRight} className="rtl:-scale-x-100"/>
            </Button>
          </div>
          <table role="grid" aria-labelledby={id} aria-multiselectable={range || undefined} className="border-separate border-spacing-y-0.5">
            <thead>
              <tr>{weekdays.map(w => <th key={w.getDay()} scope="col" abbr={fmtWeekdayLong.format(w)} className="h-(--control-sm) w-(--control) type-caption text-text-3">
                {fmtWeekday.format(w).slice(0, 2)}
              </th>)}</tr>
            </thead>
            <tbody>
              {weeksOf(m, weekStartsOn).map(week => <tr key={key(week[0])}>
                {week.map((d, col) => {
                  const outside = !sameMonth(d, m);
                  if (outside && !showOutsideDays) return <td key={key(d)} role="presentation"/>;
                  const off = isDisabled(d, disabled);
                  const isToday = same(d, today);
                  // Outside days repeat a neighbouring month's days, so only the real day shows selection.
                  const inRange = range && !outside && !!lo && !!hi && d >= lo && d <= hi;
                  const stretched = inRange && !same(lo, hi);
                  const end = !outside && (range ? same(d, lo) || same(d, hi) : same(d, single));
                  return <td
                    key={key(d)}
                    role="gridcell"
                    aria-selected={inRange || end || undefined}
                    className={cn(
                      'p-0',
                      // The band is the selected wash, rounding with the cells at its two ends.
                      stretched && 'bg-pressed forced-colors:bg-[Highlight]',
                      // It rounds at its ends and where a week breaks it.
                      stretched && (same(d, lo) || col === 0) && 'rounded-s-pill',
                      stretched && (same(d, hi) || col === 6) && 'rounded-e-pill',
                    )}
                  >
                    <button
                      type="button"
                      data-slot="calendar-day"
                      data-day={key(d)}
                      data-outside={outside || undefined}
                      data-today={(isToday && !outside) || undefined}
                      data-selected={end || undefined}
                      tabIndex={same(d, tabDate) ? 0 : -1}
                      disabled={off}
                      aria-label={`${fmtFull.format(d)}${isToday ? ', today' : ''}`}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => choose(d)}
                      onKeyDown={e => onKeyDown(e, d)}
                      onFocus={() => setFocusDate(d)}
                      onMouseEnter={() => range && setHover(d)}
                      className={dayClass}
                    >{d.getDate()}</button>
                  </td>;
                })}
              </tr>)}
            </tbody>
          </table>
        </div>;
      })}
    </div>
  </div>;
}

// ---------- time ----------

const toMinutes = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** Lenient parse to "HH:mm", or null: "930", "9:30", "9.30pm", "21" and "2130" all read; "9:5" and "9:30:00" do not. */
function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const mer = s.match(/(a|p)\.?m?\.?$/);
  const body = mer ? s.slice(0, mer.index) : s;
  let h: number, m: number;
  const parts = body.split(/[:.h]/);
  if (parts.length > 2) return null;
  if (parts.length === 2 && parts[1] !== '') {
    if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{2}$/.test(parts[1])) return null;
    h = Number(parts[0]); m = Number(parts[1]);
  } else {
    const d = parts[0];
    if (!/^\d{1,4}$/.test(d)) return null;
    if (d.length <= 2) { h = Number(d); m = 0; }
    else if (d.length === 3) { h = Number(d[0]); m = Number(d.slice(1)); }
    else { h = Number(d.slice(0, 2)); m = Number(d.slice(2)); }
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (mer[1] === 'p' ? 12 : 0);
  }
  if (h > 23) return null;
  return fromMinutes(h * 60 + m);
}

function formatTime(v: string | null | undefined, hourCycle: 12 | 24) {
  if (!v) return '';
  if (hourCycle === 24) return v;
  const [h, m] = v.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

type TimeFieldProps = {
  /** "HH:mm", 24-hour. null is empty. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Minutes between times in the list. */
  step?: 5 | 10 | 15 | 30 | 60;
  /** Shows 14:30 or 2:30 PM. The value is always 24-hour. */
  hourCycle?: 12 | 24;
  /** The earliest and latest allowed, "HH:mm". */
  min?: string;
  max?: string;
  /** The clock button and its list. Off inside the datetime popup, where typing is enough. */
  list?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: InputSize;
  name?: string;
  id?: string;
  className?: string;
  /** Start with this typed text, left as if the person tabbed away, to show the unreadable state. */
  draftText?: string;
  /** Enter on a time that reads, or an empty one. */
  onEnter?: (value: string | null) => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

/** Type a time or pick one. Typing commits on Enter or blur; Escape puts back the last good value. */
function TimeField({
  value: valueProp, defaultValue = null, onValueChange, step = 15, hourCycle = 24, min, max, list = true, placeholder, disabled: disabledProp, size = 'default', name, id,
  className, draftText, onEnter, 'aria-label': ariaLabel, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid,
}: TimeFieldProps) {
  const disabled = useFieldDisabled() || !!disabledProp;
  const [inner, setInner] = useState(defaultValue);
  const value = valueProp !== undefined ? valueProp : inner;
  const [text, setText] = useState(draftText ?? formatTime(value, hourCycle));
  const [unreadable, setUnreadable] = useState(draftText !== undefined && !parseTime(draftText));
  const [open, setOpen] = useState(false);
  const container = useGlazePortal();
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const errorId = useId();

  const seen = useRef({value, hourCycle});
  useEffect(() => {
    if (seen.current.value === value && seen.current.hourCycle === hourCycle) return;
    seen.current = {value, hourCycle};
    setText(formatTime(value, hourCycle));
    setUnreadable(false);
  }, [value, hourCycle]);

  const set = (next: string | null) => { if (valueProp === undefined) setInner(next); onValueChange?.(next); };
  const inRange = (v: string) => (!min || toMinutes(v) >= toMinutes(min)) && (!max || toMinutes(v) <= toMinutes(max));
  const options = useMemo(() => {
    const out: string[] = [];
    for (let n = 0; n < 24 * 60; n += step) { const v = fromMinutes(n); if (inRange(v)) out.push(v); }
    return out;
  }, [step, min, max]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Reads the text: the committed value, or undefined when it does not read (the reason shows). */
  const commit = (): string | null | undefined => {
    if (!text.trim()) { setUnreadable(false); if (value !== null) set(null); return null; }
    const parsed = parseTime(text);
    if (!parsed || !inRange(parsed)) { setUnreadable(true); return undefined; }
    setUnreadable(false);
    if (parsed !== value) set(parsed); else setText(formatTime(parsed, hourCycle));
    return parsed;
  };

  const nearest = () => {
    if (!options.length) return null;
    const target = value ? toMinutes(value) : 9 * 60;
    return options.reduce((a, b) => Math.abs(toMinutes(b) - target) < Math.abs(toMinutes(a) - target) ? b : a);
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role=option]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (j: number) => { e.preventDefault(); items[Math.max(0, Math.min(items.length - 1, j))]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'PageDown') go(i + 4);
    else if (e.key === 'PageUp') go(i - 4);
  };

  const invalid = !!ariaInvalid || unreadable;
  const why = unreadable ? (parseTime(text) ? `Pick a time between ${formatTime(min ?? '00:00', hourCycle)} and ${formatTime(max ?? '23:59', hourCycle)}.` : 'Not a time. Try 9:30 or 21:00.') : '';

  const field = <div data-slot="time-field" className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <InputRoot ref={boxRef} size={size} disabled={disabled} data-invalid={invalid || undefined}>
      <InputControl
        id={id}
        data-slot="time-field-input"
        value={text}
        onValueChange={v => { setText(v); if (unreadable) setUnreadable(false); }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); const done = commit(); if (done !== undefined) onEnter?.(done); }
          else if (e.key === 'Escape' && text !== formatTime(value, hourCycle)) { e.preventDefault(); e.stopPropagation(); setText(formatTime(value, hourCycle)); setUnreadable(false); }
          else if (e.key === 'ArrowDown' && e.altKey && list) { e.preventDefault(); setOpen(true); }
        }}
        disabled={disabled}
        placeholder={placeholder ?? (hourCycle === 12 ? '9:30 AM' : '09:30')}
        aria-label={ariaLabel}
        aria-describedby={cn(describedBy, unreadable && errorId) || undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        spellCheck={false}
        className="data"
      />
      {list && <InputTrailing>
        <PopoverPrimitive.Trigger data-slot="time-field-trigger" disabled={disabled} aria-label="Choose a time" render={<InputAction/>}><Icon icon={Time}/></PopoverPrimitive.Trigger>
      </InputTrailing>}
      {name && <input type="hidden" name={name} value={value ?? ''} disabled={disabled}/>}
    </InputRoot>
    {/* The reason is words, not only the coral line: FieldError's look, under the pill. */}
    <p id={errorId} role="status" data-slot="time-field-reason" className={why ? 'type-body-sm text-fail-text' : 'sr-only'}>{why}</p>
  </div>;

  if (!list) return field;
  return <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
    {field}
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner anchor={boxRef} sideOffset={6} align="start" collisionPadding={8} className="isolate z-(--z-overlay) outline-none">
        <PopoverPrimitive.Popup
          data-slot="time-field-popup"
          initialFocus={() => listRef.current?.querySelector<HTMLElement>('[aria-selected=true]') ?? listRef.current?.querySelector<HTMLElement>(`[data-time="${nearest()}"]`) ?? true}
          className={cn(menuPopupClass, 'w-(--anchor-width) min-w-32 max-h-[min(var(--popup-max),var(--available-height))]')}
        >
          <div ref={listRef} role="listbox" aria-label="Times" onKeyDown={onListKeyDown} className="flex flex-col">
            {options.map(v => {
              const selected = v === value;
              return <button
                key={v}
                type="button"
                role="option"
                data-time={v}
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => { set(v); setOpen(false); }}
                ref={el => { if (el && open && (selected || (!value && v === nearest()))) el.scrollIntoView({block: 'center'}); }}
                className={cn(menuItemClass, 'shrink-0 ps-7 text-start data hover:bg-hover focus-visible:bg-hover')}
              >
                {selected && <span className="pointer-events-none absolute start-2 flex [&_svg]:text-text-1!"><Icon icon={Check}/></span>}
                {formatTime(v, hourCycle)}
              </button>;
            })}
          </div>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}

// ---------- DatePicker ----------

type Preset = {label: string; range: DateRange};

type BaseProps = {
  placeholder?: string;
  disabled?: boolean;
  size?: InputSize;
  /** Days that cannot be picked. */
  disabledDays?: Matcher;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  locale?: string;
  /** How a date reads in the field. Default: Sep 18, 2026. */
  format?: Intl.DateTimeFormatOptions;
  /** Submits ISO values: YYYY-MM-DD or YYYY-MM-DDTHH:mm; a range submits name-from and name-to. */
  name?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  align?: 'start' | 'center' | 'end';
  /** Pin which day counts as today, for a still picture or a test. */
  today?: Date;
  /** Clear in the popup's footer, so an optional date can go back to empty. */
  clearable?: boolean;
  /** Opens with the popup open, for a still picture. */
  defaultOpen?: boolean;
  /** Classes for the popup's shell. */
  popupClassName?: string;
  /** How the popup moves to stay on screen; a still picture pins it. */
  collisionAvoidance?: PopoverPrimitive.Positioner.Props['collisionAvoidance'];
  [forced: `data-force-${string}`]: unknown;
};

type SingleProps = BaseProps & {granularity?: 'date'; mode?: 'single'; value?: Date | null; defaultValue?: Date | null; onValueChange?: (date: Date | null) => void};
type RangeProps = BaseProps & {granularity?: 'date'; mode: 'range'; value?: DateRange; defaultValue?: DateRange; onValueChange?: (range: DateRange) => void; presets?: Preset[]; numberOfMonths?: 1 | 2};
type DateTimeProps = BaseProps & {granularity: 'datetime'; mode?: 'single'; value?: Date | null; defaultValue?: Date | null; onValueChange?: (date: Date | null) => void; hourCycle?: 12 | 24};
type TimeProps = Omit<TimeFieldProps, 'list' | 'onEnter'> & {granularity: 'time'};
type DatePickerProps = SingleProps | RangeProps | DateTimeProps | TimeProps;

const NARROW = 640;

/** The width of the nearest size container around el, or of the viewport. */
function containerWidth(el: HTMLElement | null) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (getComputedStyle(node).containerType !== 'normal') return node.clientWidth;
  }
  return document.documentElement.clientWidth;
}

const iso = (d?: Date | null) => d ? key(d) : '';
const isoTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function DatePicker(props: DatePickerProps) {
  if (props.granularity === 'time') {
    const {granularity: _g, ...rest} = props;
    return <TimeField {...rest}/>;
  }
  return <DateField {...props}/>;
}

const presetClass = cn(
  'flex h-(--menu-row-sm) w-full shrink-0 items-center justify-between gap-3 rounded-tag px-2 text-start type-label whitespace-nowrap text-text-1 outline-none',
  'transition-colors duration-(--dur-state) ease-out hover:bg-hover focus-visible:focus-ring-inset aria-pressed:bg-pressed',
);

function DateField(props: SingleProps | RangeProps | DateTimeProps) {
  const {placeholder, disabled: disabledProp, size = 'default', disabledDays, weekStartsOn, locale = 'en-US', name, id, className, align = 'start', clearable, defaultOpen = false, collisionAvoidance, popupClassName} = props;
  const disabled = useFieldDisabled() || !!disabledProp;
  const range = props.mode === 'range';
  const datetime = props.granularity === 'datetime';
  const hourCycle = datetime ? (props as DateTimeProps).hourCycle ?? 24 : 24;
  const format = props.format ?? {month: 'short', day: 'numeric', year: 'numeric'};
  const container = useGlazePortal();
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [narrow, setNarrow] = useState(false);
  // Picks inside the popup go into a draft. Only a finished pick writes the value: both ends, a preset, a date, or a
  // datetime confirmed with Set or Enter. Escape and a click outside drop the draft, so the field never holds half a range.
  const [draft, setDraft] = useState<Date | DateRange | null>(null);
  const [preview, setPreview] = useState<DateRange>({});
  const onOpenChange = (next: boolean) => {
    if (next) setNarrow(containerWidth(triggerRef.current) < NARROW);
    setDraft(null);
    setOpen(next);
  };
  const close = () => onOpenChange(false);
  // Opened from the start (a still picture), it measures its room once mounted.
  useEffect(() => { if (defaultOpen) setNarrow(containerWidth(triggerRef.current) < NARROW); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const autoId = useId();
  const triggerId = id ?? autoId;

  // The trigger is a button, which Base UI's Field does not register as its control. Inside a Field, it takes its
  // name and description from the field's label, description and error, and the label focuses it.
  const [fieldIds, setFieldIds] = useState<{label?: string; described?: string}>({});
  useEffect(() => {
    const trigger = triggerRef.current;
    const field = trigger?.closest('[data-slot=field]');
    if (!trigger || !field) return;
    const update = () => {
      const label = field.querySelector('[data-slot=field-label]')?.id || undefined;
      const described = [...field.querySelectorAll('[data-slot=field-description], [data-slot=field-error]')].map(e => e.id).filter(Boolean).join(' ') || undefined;
      setFieldIds(prev => prev.label === label && prev.described === described ? prev : {label, described});
    };
    const focus = () => trigger.focus();
    const labelEl = field.querySelector('[data-slot=field-label]');
    labelEl?.addEventListener('click', focus);
    update();
    const observer = new MutationObserver(update);
    observer.observe(field, {childList: true, subtree: true});
    return () => { observer.disconnect(); labelEl?.removeEventListener('click', focus); };
  }, []);

  const [inner, setInner] = useState<Date | DateRange | null | undefined>(props.defaultValue);
  const value = props.value !== undefined ? props.value : inner;
  const set = (next: Date | DateRange | null) => {
    if (props.value === undefined) setInner(next);
    (props.onValueChange as ((v: typeof next) => void) | undefined)?.(next);
  };

  const fmt = new Intl.DateTimeFormat(locale, format);
  const span = range ? ((value as DateRange | undefined) ?? {}) : {};
  const single = range ? null : (value as Date | null | undefined) ?? null;
  const label = range
    ? span.from ? `${fmt.format(span.from)} – ${span.to ? fmt.format(span.to) : '…'}` : ''
    : single ? `${fmt.format(single)}${datetime ? `, ${formatTime(isoTime(single), hourCycle)}` : ''}` : '';
  const count = range && span.from && span.to ? daysBetween(span.from, span.to) : 0;
  const presets = range ? (props as RangeProps).presets : undefined;
  const invalid = props['aria-invalid'];

  const draftSingle = datetime ? (draft as Date | null) ?? single : single;
  const pickDay = (d: Date) => {
    if (!datetime) { set(d); close(); return; }
    const time = draftSingle ? [draftSingle.getHours(), draftSingle.getMinutes()] : [9, 0];
    setDraft(new Date(d.getFullYear(), d.getMonth(), d.getDate(), time[0], time[1]));
  };
  const withTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const base = draftSingle ?? day(props.today ?? new Date());
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
  };
  const pickTime = (t: string | null) => { if (t) setDraft(withTime(t)); };
  /** Writes the draft datetime. Enter hands over the time it just read, which has not reached the draft yet. */
  const confirm = (time?: string | null) => {
    const next = time ? withTime(time) : draftSingle;
    if (next) set(next);
    close();
  };
  const shown = range ? ((draft as DateRange | null) ?? span) : span;
  // The footer's meta: what to pick next while a range is open, else its day count.
  const pickingEnd = range && !!shown.from && !shown.to;
  const previewCount = range && preview.from && preview.to ? daysBetween(preview.from, preview.to) : 0;
  const meta = !range ? null : !shown.from ? 'Pick a start date' : pickingEnd ? (previewCount > 1 ? dayCount(previewCount) : 'Pick an end date') : count ? dayCount(count) : null;
  const canClear = clearable && (range ? !!span.from : !!single);
  const footer = range || datetime || canClear;

  const forced = Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith('data-force-')));
  return <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
    <PopoverPrimitive.Trigger
      {...forced}
      ref={triggerRef}
      id={triggerId}
      data-slot="date-picker-trigger"
      data-size={size}
      disabled={disabled}
      // The name is the label and the value together: "Report period, Sep 12 – Sep 18, 7 days".
      aria-label={props['aria-label'] ? `${props['aria-label']}, ${label ? `${label}${count ? `, ${dayCount(count)}` : ''}` : 'empty'}` : undefined}
      aria-labelledby={props['aria-label'] || !fieldIds.label ? undefined : `${fieldIds.label} ${triggerId}`}
      aria-describedby={props['aria-describedby'] ?? fieldIds.described}
      aria-invalid={invalid || undefined}
      className={cn(fieldTriggerClass, fieldTriggerSize[size], 'justify-start', className)}
    >
      <Icon icon={CalendarIcon}/>
      {/* One row, clipped: when the date and the count do not both fit, the count wraps out of sight first. */}
      <span className="flex max-h-lh min-w-0 flex-1 flex-wrap justify-between gap-x-2 overflow-hidden">
        <span className={cn('max-w-full min-w-0 truncate data', !label && 'text-text-3')}>{label || placeholder || (range ? 'Pick a range' : datetime ? 'Pick a date and time' : 'Pick a date')}</span>
        {count > 0 && <span data-slot="date-picker-count" className="shrink-0 text-text-3 data [unicode-bidi:plaintext]">{dayCount(count)}</span>}
      </span>
      <Icon icon={ChevronSort}/>
    </PopoverPrimitive.Trigger>
    {name && (range
      ? <><input type="hidden" name={`${name}-from`} value={iso(span.from)} disabled={disabled}/><input type="hidden" name={`${name}-to`} value={iso(span.to)} disabled={disabled}/></>
      : <input type="hidden" name={name} value={single ? (datetime ? `${iso(single)}T${isoTime(single)}` : iso(single)) : ''} disabled={disabled}/>)}
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner sideOffset={6} align={align} collisionPadding={8} collisionAvoidance={collisionAvoidance} className="isolate z-(--z-overlay) outline-none">
        <PopoverPrimitive.Popup
          ref={popupRef}
          data-slot="date-picker-popup"
          data-narrow={narrow || undefined}
          // value-ok: a selector for the focused day, not a class
          initialFocus={defaultOpen ? false : () => popupRef.current?.querySelector<HTMLElement>('[data-day][tabindex="0"]') ?? true}
          finalFocus={defaultOpen ? false : undefined}
          className={cn(overlayShell, overlayMotion, 'max-h-(--available-height) max-w-(--available-width) grid-rows-[minmax(0,1fr)_auto] overflow-y-auto', popupClassName)}
        >
          <div className={cn(overlayPanel, 'gap-3 p-2', !narrow && presets && 'flex-row')}>
            {presets && <ul aria-label="Presets" className={cn('flex gap-0.5', narrow ? 'flex-wrap' : 'w-32 shrink-0 flex-col border-e border-line-faint pe-2')}>
              {presets.map(p => {
                const active = same(p.range.from, span.from) && same(p.range.to, span.to);
                return <li key={p.label} className={narrow ? '' : 'w-full'}>
                  <button type="button" data-slot="date-picker-preset" aria-pressed={active} onClick={() => { set(p.range); close(); }} className={presetClass}>
                    {p.label}
                    {p.range.from && p.range.to && !/\d/.test(p.label) && <span className="type-caption text-text-3 data">{daysBetween(p.range.from, p.range.to)}d</span>}
                  </button>
                </li>;
              })}
            </ul>}
            {range
              ? <Calendar
                  mode="range"
                  selected={shown}
                  onSelect={next => { if (next.from && next.to) { set(next); close(); } else setDraft(next); }}
                  onPreview={setPreview}
                  numberOfMonths={narrow ? 1 : (props as RangeProps).numberOfMonths ?? 2}
                  disabled={disabledDays}
                  weekStartsOn={weekStartsOn}
                  locale={locale}
                  today={props.today}
                  defaultMonth={span.from}
                />
              : <Calendar selected={draftSingle} onSelect={pickDay} disabled={disabledDays} weekStartsOn={weekStartsOn} locale={locale} today={props.today} defaultMonth={single ?? undefined}/>}
            {datetime && <div className="flex items-center justify-between gap-3 border-t border-line-faint px-1 pt-2">
              <span className="type-label text-text-2">Time</span>
              <TimeField list={false} value={draftSingle ? isoTime(draftSingle) : null} onValueChange={pickTime} hourCycle={hourCycle} size="sm" aria-label="Time" className="w-24" onEnter={confirm}/>
            </div>}
          </div>
          {footer && <div data-slot="date-picker-footer" className="shell-foot">
            <span role="status" className="me-auto data [unicode-bidi:plaintext]">{meta}</span>
            {canClear && <Button variant="secondary" size="sm" data-slot="date-picker-clear" onClick={() => { set(range ? {} : null); close(); }}>Clear</Button>}
            {datetime && <Button size="sm" data-slot="date-picker-confirm" disabled={!draftSingle} onClick={() => confirm()}>Set</Button>}
          </div>}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}

export {
  Calendar, DatePicker, TimeField, addDays, addMonths, daysBetween, formatTime, parseTime,
  type CalendarProps, type DatePickerProps, type DateRange, type Matcher, type Preset, type TimeFieldProps,
};
