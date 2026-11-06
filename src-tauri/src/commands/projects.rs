//! Projects and contexts. Both lists are short, so a change sends the whole list.

use crate::db::{Db, contexts, projects};
use crate::error::AppResult;
use crate::models::{Context, Project, ProjectPatch, now_ms};
use rusqlite::Connection;
use tauri::{AppHandle, Emitter, State};

fn projects_changed(app: &AppHandle, conn: &Connection) -> AppResult<Vec<Project>> {
    let list = projects::list(conn)?;
    let _ = app.emit("projects:changed", &list);
    Ok(list)
}

fn contexts_changed(app: &AppHandle, conn: &Connection) -> AppResult<Vec<Context>> {
    let list = contexts::list(conn)?;
    let _ = app.emit("contexts:changed", &list);
    Ok(list)
}

#[tauri::command]
pub async fn project_create(app: AppHandle, db: State<'_, Db>, name: String, outcome: String) -> AppResult<Project> {
    let conn = db.lock();
    let id = projects::create(&conn, &name, &outcome, now_ms())?;
    let list = projects_changed(&app, &conn)?;
    Ok(list.into_iter().find(|p| p.id == id).expect("the project just made is listed"))
}

#[tauri::command]
pub async fn project_update(app: AppHandle, db: State<'_, Db>, id: i64, patch: ProjectPatch) -> AppResult<Vec<Project>> {
    let conn = db.lock();
    projects::update(&conn, id, patch, now_ms())?;
    projects_changed(&app, &conn)
}

#[tauri::command]
pub async fn project_delete(app: AppHandle, db: State<'_, Db>, id: i64) -> AppResult<Vec<Project>> {
    let conn = db.lock();
    projects::delete(&conn, id, now_ms())?;
    projects_changed(&app, &conn)
}

#[tauri::command]
pub async fn project_restore(app: AppHandle, db: State<'_, Db>, id: i64) -> AppResult<Vec<Project>> {
    let conn = db.lock();
    projects::restore(&conn, id)?;
    projects_changed(&app, &conn)
}

#[tauri::command]
pub async fn context_create(app: AppHandle, db: State<'_, Db>, name: String) -> AppResult<Context> {
    let conn = db.lock();
    let id = contexts::create(&conn, &name, now_ms())?;
    let list = contexts_changed(&app, &conn)?;
    Ok(list.into_iter().find(|c| c.id == id).expect("the context just made is listed"))
}

#[tauri::command]
pub async fn context_rename(app: AppHandle, db: State<'_, Db>, id: i64, name: String) -> AppResult<Vec<Context>> {
    let conn = db.lock();
    contexts::rename(&conn, id, &name)?;
    contexts_changed(&app, &conn)
}

#[tauri::command]
pub async fn context_delete(app: AppHandle, db: State<'_, Db>, id: i64) -> AppResult<Vec<Context>> {
    let conn = db.lock();
    contexts::delete(&conn, id, now_ms())?;
    contexts_changed(&app, &conn)
}

#[tauri::command]
pub async fn context_restore(app: AppHandle, db: State<'_, Db>, id: i64) -> AppResult<Vec<Context>> {
    let conn = db.lock();
    contexts::restore(&conn, id)?;
    contexts_changed(&app, &conn)
}
