mod commands;
mod db;
mod error;
mod models;
mod notify;
mod pomodoro;
mod settings;
mod shortcuts;
mod timer;
mod tray;
mod windows;

use db::Db;
use settings::Theme;
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::ShortcutState;
use timer::Timer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state == ShortcutState::Pressed {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(error) = windows::toggle_capture(&app) {
                                eprintln!("capture: {error}");
                            }
                        });
                    }
                })
                .build(),
        )
        .manage(windows::CaptureState::default())
        .setup(|app| {
            setup(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| match (window.label(), event) {
            // Closing the board hides it: the timer keeps going in the menu bar until Quit.
            ("main", WindowEvent::CloseRequested { api, .. }) => {
                api.prevent_close();
                let _ = window.hide();
            }
            ("capture", WindowEvent::CloseRequested { api, .. }) => {
                api.prevent_close();
                let _ = windows::dismiss_capture(window.app_handle(), false);
            }
            ("capture", WindowEvent::Focused(false)) => {
                let _ = windows::dismiss_capture(window.app_handle(), false);
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_bootstrap,
            commands::app::settings_update,
            commands::app::capture_dismiss,
            commands::app::client_log,
            commands::tasks::task_create,
            commands::tasks::task_update,
            commands::tasks::task_move,
            commands::tasks::task_delete,
            commands::tasks::task_restore,
            commands::tasks::task_sessions,
            commands::tasks::focus_sessions_since,
            commands::projects::project_create,
            commands::projects::project_update,
            commands::projects::project_delete,
            commands::projects::project_restore,
            commands::projects::context_create,
            commands::projects::context_rename,
            commands::projects::context_delete,
            commands::projects::context_restore,
            commands::pomodoro::pomodoro_start,
            commands::pomodoro::pomodoro_pause,
            commands::pomodoro::pomodoro_resume,
            commands::pomodoro::pomodoro_skip,
            commands::pomodoro::pomodoro_reset,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Gropius")
        .run(|app, event| match event {
            // A click on the Dock icon brings the board back.
            RunEvent::Reopen { .. } => {
                let _ = windows::show_main(app);
            }
            // A session cut short by quitting is recorded as stopped, not left open.
            RunEvent::Exit => {
                if let Some(timer) = app.try_state::<Timer>() {
                    let _ = timer.run(app, |engine, _, now| Ok(engine.reset(now)));
                }
            }
            _ => {}
        });
}

fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    // Dev and release builds share the data folder, so each keeps its own file.
    let file = if cfg!(debug_assertions) { "gropius-dev.db" } else { "gropius.db" };
    let db = Db::open(&dir.join(file))?;
    let settings = {
        let conn = db.lock();
        db::on_launch(&conn, models::now_ms())?;
        db::settings::load(&conn)?
    };
    app.manage(db);
    apply_theme(app, settings.theme);

    let (timer, wake) = Timer::new(&settings);
    app.manage(timer);
    app.manage(tray::build(app)?);
    timer::spawn_ticker(app.clone(), wake);

    if let Err(error) = shortcuts::register(app, &settings.capture_shortcut) {
        eprintln!("capture shortcut {}: {error}", settings.capture_shortcut);
    }

    // The board shows itself once it has drawn, to avoid a white flash. If it never does, show it anyway.
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(4));
        if let Some(window) = handle.get_webview_window("main")
            && !window.is_visible().unwrap_or(true)
        {
            let _ = window.show();
        }
    });
    Ok(())
}

/// Native parts (the traffic lights, menus, scrollbars) follow the app's theme; the board sets its own data-theme.
pub(crate) fn apply_theme(app: &AppHandle, theme: Theme) {
    app.set_theme(match theme {
        Theme::System => None,
        Theme::Light => Some(tauri::Theme::Light),
        Theme::Dark => Some(tauri::Theme::Dark),
    });
}
