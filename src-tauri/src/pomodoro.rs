//! The Pomodoro timer as a pure state machine. Every method takes the wall-clock time, so a sleeping Mac or a
//! hidden window cannot make it drift, and tests can drive it without waiting.

use crate::models::to_ms;
use crate::settings::Settings;
use serde::Serialize;
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Focus,
    ShortBreak,
    LongBreak,
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Phase::Focus => "focus",
            Phase::ShortBreak => "short_break",
            Phase::LongBreak => "long_break",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Phase::Focus => "Focus",
            Phase::ShortBreak => "Short break",
            Phase::LongBreak => "Long break",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TimerStatus {
    Idle,
    Running,
    Paused,
}

/// The lengths and rules the timer follows, taken from the settings.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Plan {
    pub focus: Duration,
    pub short_break: Duration,
    pub long_break: Duration,
    pub long_break_every: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
}

impl Plan {
    pub fn from_settings(settings: &Settings) -> Self {
        let minutes = |m: u32| Duration::from_secs(u64::from(m) * 60);
        Self {
            focus: minutes(settings.focus_minutes),
            short_break: minutes(settings.short_break_minutes),
            long_break: minutes(settings.long_break_minutes),
            long_break_every: settings.long_break_every.max(1),
            auto_start_breaks: settings.auto_start_breaks,
            auto_start_focus: settings.auto_start_focus,
        }
    }

    fn length(&self, phase: Phase) -> Duration {
        match phase {
            Phase::Focus => self.focus,
            Phase::ShortBreak => self.short_break,
            Phase::LongBreak => self.long_break,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedTask {
    pub id: i64,
    pub seq: i64,
    pub title: String,
}

/// What the caller has to record: a session row opens on Started and closes on Ended.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Event {
    Started { phase: Phase, planned: Duration, at: SystemTime },
    Ended { phase: Phase, completed: bool, at: SystemTime },
}

/// What the board and the menu bar draw.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub phase: Phase,
    pub status: TimerStatus,
    /// When a running phase ends, in epoch milliseconds; the board counts down to it on its own.
    pub ends_at: Option<i64>,
    pub remaining_ms: i64,
    pub planned_ms: i64,
    pub completed_in_cycle: u32,
    pub long_break_every: u32,
    pub task: Option<LinkedTask>,
}

#[derive(Debug)]
pub struct Engine {
    plan: Plan,
    phase: Phase,
    status: TimerStatus,
    ends_at: Option<SystemTime>,
    remaining: Duration,
    planned: Duration,
    completed_in_cycle: u32,
    /// The open session row. The engine never touches it: whoever records the events opens and closes it.
    pub session_id: Option<i64>,
    pub task: Option<LinkedTask>,
}

impl Engine {
    pub fn new(plan: Plan) -> Self {
        Self {
            plan,
            phase: Phase::Focus,
            status: TimerStatus::Idle,
            ends_at: None,
            remaining: plan.focus,
            planned: plan.focus,
            completed_in_cycle: 0,
            session_id: None,
            task: None,
        }
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    #[cfg(test)]
    pub fn status(&self) -> TimerStatus {
        self.status
    }

    /// Starts the current phase, or resumes it when paused.
    pub fn start(&mut self, now: SystemTime) -> Vec<Event> {
        match self.status {
            TimerStatus::Idle => {
                self.status = TimerStatus::Running;
                self.planned = self.remaining;
                self.ends_at = Some(now + self.remaining);
                vec![Event::Started { phase: self.phase, planned: self.planned, at: now }]
            }
            TimerStatus::Paused => {
                self.resume(now);
                Vec::new()
            }
            TimerStatus::Running => Vec::new(),
        }
    }

    pub fn pause(&mut self, now: SystemTime) {
        if self.status == TimerStatus::Running {
            self.remaining = self.left(now);
            self.ends_at = None;
            self.status = TimerStatus::Paused;
        }
    }

    pub fn resume(&mut self, now: SystemTime) {
        if self.status == TimerStatus::Paused {
            self.ends_at = Some(now + self.remaining);
            self.status = TimerStatus::Running;
        }
    }

    /// Start, pause or resume, whichever the timer is ready for.
    pub fn toggle(&mut self, now: SystemTime) -> Vec<Event> {
        match self.status {
            TimerStatus::Running => {
                self.pause(now);
                Vec::new()
            }
            _ => self.start(now),
        }
    }

    /// Abandons the current phase and starts the next one.
    pub fn skip(&mut self, now: SystemTime) -> Vec<Event> {
        let mut events = self.abandon(now);
        let next = self.next_phase();
        if self.phase == Phase::LongBreak {
            self.completed_in_cycle = 0;
        }
        self.enter(next);
        events.extend(self.start(now));
        events
    }

    /// Abandons the current phase and waits, ready to focus.
    pub fn reset(&mut self, now: SystemTime) -> Vec<Event> {
        let events = self.abandon(now);
        self.enter(Phase::Focus);
        events
    }

    /// Ends the phase if its time is up and moves to the next one. A Mac that slept through the end finishes the
    /// phase once on waking, and the next phase starts from then, not from when the last one should have ended.
    pub fn poll(&mut self, now: SystemTime) -> Vec<Event> {
        let Some(ends_at) = self.ends_at.filter(|end| *end <= now) else { return Vec::new() };
        let finished = self.phase;
        let mut events = vec![Event::Ended { phase: finished, completed: true, at: ends_at }];
        if finished == Phase::Focus {
            self.completed_in_cycle += 1;
        }
        let next = self.next_phase();
        if finished == Phase::LongBreak {
            self.completed_in_cycle = 0;
        }
        self.enter(next);
        let auto = if next == Phase::Focus { self.plan.auto_start_focus } else { self.plan.auto_start_breaks };
        if auto {
            events.extend(self.start(now));
        }
        events
    }

    /// New lengths apply at once to a timer that is waiting, and to the next phase otherwise.
    pub fn set_plan(&mut self, plan: Plan) {
        self.plan = plan;
        if self.status == TimerStatus::Idle {
            self.remaining = plan.length(self.phase);
            self.planned = self.remaining;
        }
    }

    pub fn snapshot(&self, now: SystemTime) -> Snapshot {
        Snapshot {
            phase: self.phase,
            status: self.status,
            ends_at: self.ends_at.map(to_ms),
            remaining_ms: self.left(now).as_millis() as i64,
            planned_ms: self.planned.as_millis() as i64,
            completed_in_cycle: self.completed_in_cycle,
            long_break_every: self.plan.long_break_every,
            task: self.task.clone(),
        }
    }

    fn left(&self, now: SystemTime) -> Duration {
        match self.ends_at {
            Some(end) => end.duration_since(now).unwrap_or(Duration::ZERO),
            None => self.remaining,
        }
    }

    fn abandon(&mut self, now: SystemTime) -> Vec<Event> {
        if self.status == TimerStatus::Idle {
            return Vec::new();
        }
        vec![Event::Ended { phase: self.phase, completed: false, at: now }]
    }

    fn next_phase(&self) -> Phase {
        match self.phase {
            Phase::Focus if self.completed_in_cycle >= self.plan.long_break_every => Phase::LongBreak,
            Phase::Focus => Phase::ShortBreak,
            Phase::ShortBreak | Phase::LongBreak => Phase::Focus,
        }
    }

    fn enter(&mut self, phase: Phase) {
        self.phase = phase;
        self.status = TimerStatus::Idle;
        self.ends_at = None;
        self.remaining = self.plan.length(phase);
        self.planned = self.remaining;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIN: Duration = Duration::from_secs(60);

    fn plan(auto_breaks: bool, auto_focus: bool) -> Plan {
        Plan {
            focus: 25 * MIN,
            short_break: 5 * MIN,
            long_break: 15 * MIN,
            long_break_every: 4,
            auto_start_breaks: auto_breaks,
            auto_start_focus: auto_focus,
        }
    }

    fn at(minutes: u64) -> SystemTime {
        SystemTime::UNIX_EPOCH + Duration::from_secs(1_800_000_000 + minutes * 60)
    }

    #[test]
    fn runs_a_full_cycle_with_a_long_break_after_four() {
        let mut timer = Engine::new(plan(true, true));
        let mut now = 0;
        timer.start(at(now));
        let mut phases = Vec::new();
        for _ in 0..8 {
            now += timer.snapshot(at(now)).remaining_ms as u64 / 60_000;
            let events = timer.poll(at(now));
            assert!(matches!(events[0], Event::Ended { completed: true, .. }));
            phases.push(timer.phase());
        }
        use Phase::*;
        assert_eq!(phases, [ShortBreak, Focus, ShortBreak, Focus, ShortBreak, Focus, LongBreak, Focus]);
        assert_eq!(timer.snapshot(at(now)).completed_in_cycle, 0);
    }

    #[test]
    fn waits_after_a_phase_when_auto_start_is_off() {
        let mut timer = Engine::new(plan(false, false));
        timer.start(at(0));
        let events = timer.poll(at(25));
        assert_eq!(events.len(), 1);
        assert_eq!((timer.phase(), timer.status()), (Phase::ShortBreak, TimerStatus::Idle));
        assert_eq!(timer.snapshot(at(30)).remaining_ms, (5 * MIN).as_millis() as i64);
    }

    #[test]
    fn pause_keeps_the_time_left() {
        let mut timer = Engine::new(plan(true, false));
        timer.start(at(0));
        timer.pause(at(10));
        assert!(timer.poll(at(60)).is_empty());
        timer.resume(at(60));
        assert_eq!(timer.snapshot(at(60)).remaining_ms, (15 * MIN).as_millis() as i64);
        assert!(timer.poll(at(74)).is_empty());
        assert_eq!(timer.poll(at(75)).len(), 2);
    }

    #[test]
    fn sleeping_through_the_end_finishes_once_and_restarts_from_waking() {
        let mut timer = Engine::new(plan(true, true));
        timer.start(at(0));
        let events = timer.poll(at(300));
        assert_eq!(events.len(), 2);
        assert_eq!(events[0], Event::Ended { phase: Phase::Focus, completed: true, at: at(25) });
        assert_eq!(events[1], Event::Started { phase: Phase::ShortBreak, planned: 5 * MIN, at: at(300) });
        assert!(timer.poll(at(301)).is_empty());
    }

    #[test]
    fn skip_abandons_and_starts_the_next_phase() {
        let mut timer = Engine::new(plan(false, false));
        timer.start(at(0));
        let events = timer.skip(at(3));
        assert!(matches!(events[0], Event::Ended { phase: Phase::Focus, completed: false, .. }));
        assert!(matches!(events[1], Event::Started { phase: Phase::ShortBreak, .. }));
        assert_eq!(timer.snapshot(at(3)).completed_in_cycle, 0);
    }

    #[test]
    fn reset_returns_to_a_waiting_focus() {
        let mut timer = Engine::new(plan(true, true));
        timer.start(at(0));
        timer.poll(at(25));
        let events = timer.reset(at(26));
        assert!(matches!(events[0], Event::Ended { phase: Phase::ShortBreak, completed: false, .. }));
        assert_eq!((timer.phase(), timer.status()), (Phase::Focus, TimerStatus::Idle));
        assert!(timer.reset(at(27)).is_empty());
    }

    #[test]
    fn new_lengths_apply_to_a_waiting_timer() {
        let mut timer = Engine::new(plan(true, true));
        timer.set_plan(Plan { focus: 50 * MIN, ..plan(true, true) });
        assert_eq!(timer.snapshot(at(0)).remaining_ms, (50 * MIN).as_millis() as i64);
    }
}
