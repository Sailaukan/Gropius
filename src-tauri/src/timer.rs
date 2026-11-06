//! Runs the Pomodoro engine: records its sessions, tells the windows, and keeps the menu bar ticking from a thread of
//! its own, so the time stays right with every window closed.
//!
//! Locks: the engine before the database, and neither while calling the tray or window APIs (those wait for the main
//! thread, which may be waiting for a lock).

use crate::db::{Db, sessions, tasks};
use crate::error::AppResult;
use crate::models::{Task, TasksChanged, to_ms};
use crate::notify;
use crate::pomodoro::{Engine, Event, LinkedTask, Phase, Plan, Snapshot, TimerStatus};
use crate::settings::Settings;
use crate::tray;
use rusqlite::Connection;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter, Manager};

pub struct Timer {
    engine: Mutex<Engine>,
    wake: Sender<()>,
    show_time: AtomicBool,
    sound: AtomicBool,
}

/// What happened while the locks were held, to act on once they are released.
#[derive(Default)]
struct Outcome {
    changed_tasks: Vec<Task>,
    finished: Vec<Phase>,
}

impl Timer {
    pub fn new(settings: &Settings) -> (Self, Receiver<()>) {
        let (wake, rx) = mpsc::channel();
        let timer = Self {
            engine: Mutex::new(Engine::new(Plan::from_settings(settings))),
            wake,
            show_time: AtomicBool::new(settings.show_time_in_menu_bar),
            sound: AtomicBool::new(settings.sound_enabled),
        };
        (timer, rx)
    }

    fn lock(&self) -> MutexGuard<'_, Engine> {
        self.engine.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn snapshot(&self) -> Snapshot {
        self.lock().snapshot(SystemTime::now())
    }

    /// Changes the timer from a command or the menu: records what happened, tells every window and redraws the
    /// menu bar.
    pub fn run<F>(&self, app: &AppHandle, change: F) -> AppResult<Snapshot>
    where
        F: FnOnce(&mut Engine, &Connection, SystemTime) -> AppResult<Vec<Event>>,
    {
        let (snapshot, outcome) = self.apply(app, change)?;
        announce(app, &snapshot, outcome);
        let _ = self.wake.send(());
        Ok(snapshot)
    }

    fn apply<F>(&self, app: &AppHandle, change: F) -> AppResult<(Snapshot, Outcome)>
    where
        F: FnOnce(&mut Engine, &Connection, SystemTime) -> AppResult<Vec<Event>>,
    {
        let now = SystemTime::now();
        let mut engine = self.lock();
        let db = app.state::<Db>();
        let conn = db.lock();
        let events = change(&mut engine, &conn, now)?;
        let outcome = record(&mut engine, &conn, &events)?;
        Ok((engine.snapshot(now), outcome))
    }

    pub fn apply_settings(&self, settings: &Settings) {
        self.lock().set_plan(Plan::from_settings(settings));
        self.show_time.store(settings.show_time_in_menu_bar, Ordering::Relaxed);
        self.sound.store(settings.sound_enabled, Ordering::Relaxed);
        let _ = self.wake.send(());
    }

    /// Keeps the menu's task line in step when the linked task is renamed or deleted.
    pub fn task_changed(&self, app: &AppHandle, id: i64, title: Option<&str>) {
        let mut engine = self.lock();
        let Some(linked) = engine.task.as_mut().filter(|t| t.id == id) else { return };
        match title {
            Some(title) => linked.title = title.to_string(),
            None => engine.task = None,
        }
        let snapshot = engine.snapshot(SystemTime::now());
        drop(engine);
        let _ = app.emit("pomodoro:state", &snapshot);
        let _ = self.wake.send(());
    }
}

/// Opens and closes session rows, and counts a finished focus session on its task.
fn record(engine: &mut Engine, conn: &Connection, events: &[Event]) -> AppResult<Outcome> {
    let mut outcome = Outcome::default();
    for event in events {
        match *event {
            Event::Started { phase, planned, at } => {
                let task = engine.task.as_ref().map(|t| t.id);
                engine.session_id =
                    Some(sessions::start(conn, task, phase.as_str(), planned.as_millis() as i64, to_ms(at))?);
            }
            Event::Ended { phase, completed, at } => {
                let Some(id) = engine.session_id.take() else { continue };
                let task = sessions::finish(conn, id, completed, to_ms(at))?;
                if completed {
                    outcome.finished.push(phase);
                    if let (Phase::Focus, Some(task)) = (phase, task) {
                        outcome.changed_tasks.push(tasks::add_pomodoro(conn, task, to_ms(at))?);
                    }
                }
            }
        }
    }
    Ok(outcome)
}

fn announce(app: &AppHandle, snapshot: &Snapshot, outcome: Outcome) {
    let _ = app.emit("pomodoro:state", snapshot);
    if !outcome.changed_tasks.is_empty() {
        let _ = app.emit("tasks:changed", TasksChanged { upserted: outcome.changed_tasks, deleted: Vec::new() });
    }
    let sound = app.state::<Timer>().sound.load(Ordering::Relaxed);
    for phase in outcome.finished {
        notify::phase_finished(app, phase, snapshot, sound);
    }
}

/// Moves the timer along and redraws the menu bar on each second while it runs, and whenever something nudges it.
pub fn spawn_ticker(app: AppHandle, wake: Receiver<()>) {
    std::thread::Builder::new()
        .name("pomodoro".into())
        .spawn(move || {
            loop {
                let timer = app.state::<Timer>();
                let snapshot = match timer.apply(&app, |engine, _, now| Ok(engine.poll(now))) {
                    Ok((snapshot, outcome)) => {
                        if !outcome.finished.is_empty() {
                            announce(&app, &snapshot, outcome);
                        }
                        snapshot
                    }
                    Err(error) => {
                        eprintln!("pomodoro: {error}");
                        timer.snapshot()
                    }
                };
                tray::render(&app, &snapshot, timer.show_time.load(Ordering::Relaxed));

                let wait = match snapshot.status {
                    // Wake just after the shown second changes.
                    TimerStatus::Running => Duration::from_millis((snapshot.remaining_ms % 1000) as u64 + 5),
                    _ => Duration::from_secs(60),
                };
                match wake.recv_timeout(wait) {
                    Err(RecvTimeoutError::Disconnected) => break,
                    _ => while wake.try_recv().is_ok() {},
                }
            }
        })
        .expect("start the pomodoro thread");
}

/// Looks up a task to link to the timer.
pub fn linked_task(conn: &Connection, id: i64) -> AppResult<LinkedTask> {
    let task = tasks::get(conn, id)?;
    Ok(LinkedTask { id: task.id, seq: task.seq, title: task.title })
}

/// Links a task to the timer, and to the session that is open now.
pub fn link(engine: &mut Engine, conn: &Connection, task: Option<LinkedTask>) -> AppResult<()> {
    if let Some(session) = engine.session_id {
        sessions::set_task(conn, session, task.as_ref().map(|t| t.id))?;
    }
    engine.task = task;
    Ok(())
}
