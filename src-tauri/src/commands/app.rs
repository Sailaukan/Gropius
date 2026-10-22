use crate::db::{self, Db, contexts, projects, tasks};
use crate::error::AppResult;
use crate::models::{Context, Project, Task};
use crate::pomodoro::Snapshot;
use crate::settings::Settings;
use crate::timer::Timer;
use crate::{apply_theme, shortcuts, windows};
use serde::Serialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter, State};

/// Everything a window needs to draw, in one call.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    tasks: Vec<Task>,
    projects: Vec<Project>,
    contexts: Vec<Context>,
    settings: Settings,
    pomodoro: Snapshot,
}

#[tauri::command]
pub async fn app_bootstrap(db: State<'_, Db>, timer: State<'_, Timer>) -> AppResult<Bootstrap> {
    let pomodoro = timer.snapshot();
    let conn = db.lock();
    Ok(Bootstrap {
        tasks: tasks::list(&conn)?,
        projects: projects::list(&conn)?,
        contexts: contexts::list(&conn)?,
        settings: db::settings::load(&conn)?,
        pomodoro,
    })
}

/// Applies a partial settings change, such as {"focusMinutes": 30}. A new capture shortcut is tried first and
/// nothing is saved if macOS will not register it.
#[tauri::command]
pub async fn settings_update(
    app: AppHandle,
    db: State<'_, Db>,
    timer: State<'_, Timer>,
    patch: Map<String, Value>,
) -> AppResult<Settings> {
    let before = db::settings::load(&db.lock())?;
    if let Some(Value::String(shortcut)) = patch.get("captureShortcut")
        && *shortcut != before.capture_shortcut
    {
        shortcuts::change(&app, &before.capture_shortcut, shortcut)?;
    }
    let settings = db::settings::update(&db.lock(), patch)?;
    if settings.theme != before.theme {
        apply_theme(&app, settings.theme);
    }
    timer.apply_settings(&settings);
    let _ = app.emit("settings:changed", &settings);
    Ok(settings)
}

/// Enter and Esc in the capture box send focus back to the app the person came from.
#[tauri::command]
pub async fn capture_dismiss(app: AppHandle) -> AppResult<()> {
    Ok(windows::dismiss_capture(&app, true)?)
}

/// Errors from a window's JavaScript, written to the app's log so they are not lost inside the webview.
#[tauri::command]
pub fn client_log(window: tauri::Window, message: String) {
    eprintln!("[{}] {message}", window.label());
}
