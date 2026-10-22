use super::tasks_changed;
use crate::db::{Db, sessions, tasks};
use crate::error::AppResult;
use crate::models::{NewTask, Session, Status, Task, TaskPatch, now_ms};
use crate::timer::Timer;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn task_create(app: AppHandle, db: State<'_, Db>, input: NewTask) -> AppResult<Task> {
    let task = tasks::create(&db.lock(), input, now_ms())?;
    tasks_changed(&app, vec![task.clone()], Vec::new());
    Ok(task)
}

#[tauri::command]
pub async fn task_update(
    app: AppHandle,
    db: State<'_, Db>,
    timer: State<'_, Timer>,
    id: i64,
    patch: TaskPatch,
) -> AppResult<Task> {
    let renamed = patch.title.is_some();
    let task = tasks::update(&db.lock(), id, patch, now_ms())?;
    if renamed {
        timer.task_changed(&app, id, Some(&task.title));
    }
    tasks_changed(&app, vec![task.clone()], Vec::new());
    Ok(task)
}

/// Where a drag ends: the column, and the tasks just above and below.
#[tauri::command]
pub async fn task_move(
    app: AppHandle,
    db: State<'_, Db>,
    id: i64,
    status: Status,
    prev_id: Option<i64>,
    next_id: Option<i64>,
) -> AppResult<Vec<Task>> {
    let changed = tasks::move_to(&db.lock(), id, status, prev_id, next_id, now_ms())?;
    tasks_changed(&app, changed.clone(), Vec::new());
    Ok(changed)
}

#[tauri::command]
pub async fn task_delete(app: AppHandle, db: State<'_, Db>, timer: State<'_, Timer>, id: i64) -> AppResult<()> {
    tasks::delete(&db.lock(), id, now_ms())?;
    timer.task_changed(&app, id, None);
    tasks_changed(&app, Vec::new(), vec![id]);
    Ok(())
}

#[tauri::command]
pub async fn task_restore(app: AppHandle, db: State<'_, Db>, id: i64) -> AppResult<Task> {
    let task = tasks::restore(&db.lock(), id)?;
    tasks_changed(&app, vec![task.clone()], Vec::new());
    Ok(task)
}

#[tauri::command]
pub async fn task_sessions(db: State<'_, Db>, id: i64) -> AppResult<Vec<Session>> {
    sessions::for_task(&db.lock(), id)
}

#[tauri::command]
pub async fn focus_sessions_since(db: State<'_, Db>, since: i64) -> AppResult<i64> {
    sessions::completed_focus_since(&db.lock(), since)
}
