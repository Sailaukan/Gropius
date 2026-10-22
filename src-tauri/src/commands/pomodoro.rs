use super::tasks_changed;
use crate::db::{self, Db, tasks};
use crate::error::AppResult;
use crate::models::{Status, TaskPatch, now_ms};
use crate::pomodoro::{Phase, Snapshot};
use crate::timer::{self, Timer};
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn pomodoro_state(timer: State<'_, Timer>) -> AppResult<Snapshot> {
    Ok(timer.snapshot())
}

/// Starts or resumes the timer. With a task, it is a focus session on that task: a break in the way is abandoned,
/// and the task moves to In progress when the setting says so.
#[tauri::command]
pub async fn pomodoro_start(
    app: AppHandle,
    db: State<'_, Db>,
    timer: State<'_, Timer>,
    task_id: Option<i64>,
) -> AppResult<Snapshot> {
    if let Some(id) = task_id {
        let moved = {
            let conn = db.lock();
            let settings = db::settings::load(&conn)?;
            let task = tasks::get(&conn, id)?;
            if settings.move_to_in_progress && matches!(task.status, Status::Backlog | Status::Todo) {
                let patch = TaskPatch { status: Some(Status::InProgress), ..Default::default() };
                Some(tasks::update(&conn, id, patch, now_ms())?)
            } else {
                None
            }
        };
        if let Some(task) = moved {
            tasks_changed(&app, vec![task], Vec::new());
        }
    }

    timer.run(&app, |engine, conn, now| {
        let mut events = Vec::new();
        if let Some(id) = task_id {
            if engine.phase() != Phase::Focus {
                events.extend(engine.reset(now));
            }
            let task = timer::linked_task(conn, id)?;
            if events.is_empty() {
                timer::link(engine, conn, Some(task))?;
            } else {
                // The abandoned break's row closes as it was; the new focus row opens with this task.
                engine.task = Some(task);
            }
        }
        events.extend(engine.start(now));
        Ok(events)
    })
}

#[tauri::command]
pub async fn pomodoro_pause(app: AppHandle, timer: State<'_, Timer>) -> AppResult<Snapshot> {
    timer.run(&app, |engine, _, now| {
        engine.pause(now);
        Ok(Vec::new())
    })
}

#[tauri::command]
pub async fn pomodoro_resume(app: AppHandle, timer: State<'_, Timer>) -> AppResult<Snapshot> {
    timer.run(&app, |engine, _, now| {
        engine.resume(now);
        Ok(Vec::new())
    })
}

#[tauri::command]
pub async fn pomodoro_skip(app: AppHandle, timer: State<'_, Timer>) -> AppResult<Snapshot> {
    timer.run(&app, |engine, _, now| Ok(engine.skip(now)))
}

#[tauri::command]
pub async fn pomodoro_reset(app: AppHandle, timer: State<'_, Timer>) -> AppResult<Snapshot> {
    timer.run(&app, |engine, _, now| Ok(engine.reset(now)))
}

#[tauri::command]
pub async fn pomodoro_link(app: AppHandle, timer: State<'_, Timer>, task_id: Option<i64>) -> AppResult<Snapshot> {
    timer.run(&app, |engine, conn, _| {
        let task = task_id.map(|id| timer::linked_task(conn, id)).transpose()?;
        timer::link(engine, conn, task)?;
        Ok(Vec::new())
    })
}
