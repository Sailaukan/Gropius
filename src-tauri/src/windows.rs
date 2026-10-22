use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const CAPTURE: &str = "capture";
// The box is 560 by 88. The window adds clear room around it for the box's shadow: 32 at the sides, 24 above and 48
// below, the padding in capture-window.tsx.
const CAPTURE_WIDTH: f64 = 560.0 + 32.0 * 2.0;
const CAPTURE_HEIGHT: f64 = 88.0 + 24.0 + 48.0;

/// The app that was in front when the capture box opened, so focus can go back to it.
#[derive(Default)]
pub struct CaptureState(Mutex<Option<i32>>);

pub fn show_main(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }
    Ok(())
}

/// The global shortcut opens the capture box, or closes it when it is already in front.
pub fn toggle_capture(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(CAPTURE)
        && window.is_visible()?
        && window.is_focused()?
    {
        return dismiss_capture(app, true);
    }
    show_capture(app)
}

pub fn show_capture(app: &AppHandle) -> tauri::Result<()> {
    *app.state::<CaptureState>().0.lock().unwrap_or_else(|p| p.into_inner()) = frontmost_other_app();
    let window = match app.get_webview_window(CAPTURE) {
        Some(window) => window,
        None => create_capture(app)?,
    };
    place_under_cursor(app, &window)?;
    window.show()?;
    window.set_focus()?;
    app.emit_to(CAPTURE, "capture:shown", ())?;
    Ok(())
}

/// Hides the capture box. After Enter or Esc focus goes back to the app the person came from; after a click
/// elsewhere it stays where they clicked.
pub fn dismiss_capture(app: &AppHandle, return_focus: bool) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(CAPTURE) {
        window.hide()?;
    }
    let previous = app.state::<CaptureState>().0.lock().unwrap_or_else(|p| p.into_inner()).take();
    if let (true, Some(pid)) = (return_focus, previous) {
        activate_app(app, pid);
    }
    Ok(())
}

fn create_capture(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    WebviewWindowBuilder::new(app, CAPTURE, WebviewUrl::App("capture.html".into()))
        .title("Quick capture")
        .inner_size(CAPTURE_WIDTH, CAPTURE_HEIGHT)
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .skip_taskbar(true)
        .visible(false)
        .build()
}

/// Centred on the screen the pointer is on, a quarter of the way down.
fn place_under_cursor(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<()> {
    let cursor = app.cursor_position()?;
    let monitor = match app.monitor_from_point(cursor.x, cursor.y)? {
        Some(monitor) => monitor,
        None => match app.primary_monitor()? {
            Some(monitor) => monitor,
            None => return Ok(()),
        },
    };
    let area = monitor.work_area();
    let width = (CAPTURE_WIDTH * monitor.scale_factor()) as i32;
    let x = area.position.x + (area.size.width as i32 - width) / 2;
    let y = area.position.y + area.size.height as i32 / 4;
    window.set_position(PhysicalPosition::new(x, y))
}

fn frontmost_other_app() -> Option<i32> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSWorkspace;
        let pid = NSWorkspace::sharedWorkspace().frontmostApplication()?.processIdentifier();
        (pid != std::process::id() as i32).then_some(pid)
    }
    #[cfg(not(target_os = "macos"))]
    None
}

fn activate_app(app: &AppHandle, pid: i32) {
    #[cfg(target_os = "macos")]
    let _ = app.run_on_main_thread(move || {
        use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};
        if let Some(previous) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid) {
            previous.activateWithOptions(NSApplicationActivationOptions::empty());
        }
    });
}
