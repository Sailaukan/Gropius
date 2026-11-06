use crate::pomodoro::{Phase, Snapshot, TimerStatus};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// Says a phase is over. The sound plays on its own, so it is heard even when macOS holds the banner back (it does
/// while Gropius is the frontmost app).
pub fn phase_finished(app: &AppHandle, finished: Phase, next: &Snapshot, sound: bool) {
    let minutes = (next.planned_ms + 59_999) / 60_000;
    let running = next.status == TimerStatus::Running;
    let (title, body) = match (finished, next.phase) {
        (Phase::Focus, _) if running => ("Focus complete".to_string(), format!("Take a {minutes}-minute break.")),
        (Phase::Focus, _) => ("Focus complete".to_string(), "Start your break when you are ready.".to_string()),
        (_, _) if running => ("Break over".to_string(), format!("Focus for {minutes} minutes.")),
        (_, _) => ("Break over".to_string(), "Start a focus session when you are ready.".to_string()),
    };
    let body = match (&next.task, next.phase) {
        (Some(task), Phase::Focus) => format!("{body} Task: {}", task.title),
        _ => body,
    };
    if let Err(error) = app.notification().builder().title(title).body(body).show() {
        eprintln!("notification: {error}");
    }
    if sound {
        play_chime(app);
    }
}

fn play_chime(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.run_on_main_thread(|| {
        use objc2_app_kit::NSSound;
        use objc2_foundation::NSString;
        if let Some(sound) = NSSound::soundNamed(&NSString::from_str("Glass")) {
            sound.play();
        }
    });
}
