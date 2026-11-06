use crate::error::{AppError, AppResult};
use tauri::AppHandle;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

/// Makes the capture shortcut the only global shortcut Gropius holds.
pub fn register(app: &AppHandle, accelerator: &str) -> AppResult<()> {
    let shortcuts = app.global_shortcut();
    shortcuts.unregister_all().map_err(invalid)?;
    shortcuts.register(accelerator).map_err(invalid)
}

/// Swaps the capture shortcut, and puts the old one back if macOS refuses the new one.
pub fn change(app: &AppHandle, old: &str, new: &str) -> AppResult<()> {
    register(app, new).map_err(|error| {
        let _ = register(app, old);
        AppError::Invalid(format!("Gropius could not use {new} as a shortcut: {error}"))
    })
}

fn invalid(error: tauri_plugin_global_shortcut::Error) -> AppError {
    AppError::Invalid(error.to_string())
}
