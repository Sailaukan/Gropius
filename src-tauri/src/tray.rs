//! The menu bar item: a template icon, the time left beside it while a session runs, and a native menu.

use crate::pomodoro::{Phase, Snapshot, TimerStatus};
use crate::timer::Timer;
use crate::windows;
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Manager, Wry};

const FOCUS_ICON: Image<'static> = tauri::include_image!("icons/tray-focus.png");
const BREAK_ICON: Image<'static> = tauri::include_image!("icons/tray-break.png");
const PAUSED_ICON: Image<'static> = tauri::include_image!("icons/tray-paused.png");

pub struct TrayMenu {
    tray: TrayIcon,
    header: MenuItem<Wry>,
    task: MenuItem<Wry>,
    toggle: MenuItem<Wry>,
    skip: MenuItem<Wry>,
    reset: MenuItem<Wry>,
    drawn: Mutex<Drawn>,
}

/// What is on screen now, so a tick only touches what changed.
#[derive(Default, Clone, PartialEq)]
struct Drawn {
    icon: &'static str,
    title: Option<String>,
    header: String,
    task: String,
    toggle: String,
    skip: String,
    reset: bool,
}

pub fn build(app: &AppHandle) -> tauri::Result<TrayMenu> {
    let header = MenuItem::with_id(app, "tray:header", "Focus", false, None::<&str>)?;
    let task = MenuItem::with_id(app, "tray:task", "No task linked", false, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "tray:toggle", "Start focus", true, None::<&str>)?;
    let skip = MenuItem::with_id(app, "tray:skip", "Skip to break", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "tray:reset", "Reset timer", false, None::<&str>)?;
    let open = MenuItem::with_id(app, "tray:open", "Open board", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "tray:capture", "Quick capture", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "tray:quit", "Quit Gropius", true, Some("CmdOrCtrl+Q"))?;
    let menu = Menu::with_items(
        app,
        &[
            &header,
            &task,
            &PredefinedMenuItem::separator(app)?,
            &toggle,
            &skip,
            &reset,
            &PredefinedMenuItem::separator(app)?,
            &open,
            &capture,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let tray = TrayIconBuilder::with_id("gropius")
        .icon(FOCUS_ICON)
        .icon_as_template(true)
        .tooltip("Gropius")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(on_menu_event)
        .build(app)?;
    configure_status_item(&tray);

    Ok(TrayMenu { tray, header, task, toggle, skip, reset, drawn: Mutex::new(Drawn::default()) })
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    let timer = app.state::<Timer>();
    let result = match event.id.as_ref() {
        "tray:toggle" => timer.run(app, |engine, _, now| Ok(engine.toggle(now))).map(drop),
        "tray:skip" => timer.run(app, |engine, _, now| Ok(engine.skip(now))).map(drop),
        "tray:reset" => timer.run(app, |engine, _, now| Ok(engine.reset(now))).map(drop),
        "tray:open" => windows::show_main(app).map_err(Into::into),
        "tray:capture" => windows::show_capture(app).map_err(Into::into),
        "tray:quit" => {
            app.exit(0);
            Ok(())
        }
        _ => Ok(()),
    };
    if let Err(error) = result {
        eprintln!("menu bar: {error}");
    }
}

/// Redraws the menu bar item from the timer. Called only from the timer's thread.
pub fn render(app: &AppHandle, snapshot: &Snapshot, show_time: bool) {
    let Some(menu) = app.try_state::<TrayMenu>() else { return };
    let next = draw(snapshot, show_time);
    let previous = {
        let mut drawn = menu.drawn.lock().unwrap_or_else(|p| p.into_inner());
        if *drawn == next {
            return;
        }
        std::mem::replace(&mut *drawn, next.clone())
    };

    if next.icon != previous.icon {
        let icon = match next.icon {
            "break" => BREAK_ICON,
            "paused" => PAUSED_ICON,
            _ => FOCUS_ICON,
        };
        let _ = menu.tray.set_icon_with_as_template(Some(icon), true);
    }
    if next.title != previous.title {
        let _ = menu.tray.set_title(next.title.as_deref());
    }
    if next.header != previous.header {
        let _ = menu.header.set_text(&next.header);
    }
    if next.task != previous.task {
        let _ = menu.task.set_text(&next.task);
    }
    if next.toggle != previous.toggle {
        let _ = menu.toggle.set_text(&next.toggle);
    }
    if next.skip != previous.skip {
        let _ = menu.skip.set_text(&next.skip);
    }
    if next.reset != previous.reset {
        let _ = menu.reset.set_enabled(next.reset);
    }
}

fn draw(snapshot: &Snapshot, show_time: bool) -> Drawn {
    let left = clock(snapshot.remaining_ms);
    let phase = snapshot.phase.label();
    let on_break = snapshot.phase != Phase::Focus;
    Drawn {
        icon: match snapshot.status {
            TimerStatus::Paused => "paused",
            _ if on_break => "break",
            _ => "focus",
        },
        title: (snapshot.status != TimerStatus::Idle && show_time).then(|| left.clone()),
        header: match snapshot.status {
            TimerStatus::Idle => format!("{phase}, {} min", (snapshot.remaining_ms + 59_999) / 60_000),
            TimerStatus::Running => format!("{phase} · {left} left"),
            TimerStatus::Paused => format!("{phase} paused · {left} left"),
        },
        task: match &snapshot.task {
            Some(task) => truncate(&format!("Task: GRP-{} {}", task.seq, task.title), 44),
            None => "No task linked".into(),
        },
        toggle: match snapshot.status {
            TimerStatus::Running => "Pause".into(),
            TimerStatus::Paused => "Resume".into(),
            TimerStatus::Idle if on_break => "Start break".into(),
            TimerStatus::Idle => "Start focus".into(),
        },
        skip: if on_break { "Skip to focus".into() } else { "Skip to break".into() },
        reset: snapshot.status != TimerStatus::Idle,
    }
}

/// 24:13, or 1:05:00 past an hour, counting a started second as a whole one so it never shows 0:00 early.
pub fn clock(remaining_ms: i64) -> String {
    let total = (remaining_ms.max(0) + 999) / 1000;
    let (hours, minutes, seconds) = (total / 3600, total % 3600 / 60, total % 60);
    if hours > 0 { format!("{hours}:{minutes:02}:{seconds:02}") } else { format!("{minutes}:{seconds:02}") }
}

fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let cut: String = text.chars().take(max - 1).collect();
    format!("{}…", cut.trim_end())
}

/// Two touches tray-icon has no API for. The menu bar's font gives each digit its own width, so a ticking 24:13 would
/// shift the icons beside it: the button's font is set once to monospaced digits, and tray-icon's later setTitle calls
/// keep it while still resizing the click area. And a fixed autosave name lets macOS remember where the person
/// ⌘-drags the item, which matters on a notched screen where a crowded menu bar hides items under the camera.
fn configure_status_item(tray: &TrayIcon) {
    #[cfg(target_os = "macos")]
    let _ = tray.with_inner_tray_icon(|inner| {
        use objc2::MainThreadMarker;
        use objc2_app_kit::{NSFont, NSFontWeightRegular};
        use objc2_foundation::{NSString, NSUserDefaults};
        let Some(mtm) = MainThreadMarker::new() else { return };
        let Some(item) = inner.ns_status_item() else { return };
        // New items join the crowded left end of the menu bar, which a notch can hide. The first time, ask for a
        // place near the clock (macOS counts from the right edge: Battery sits at 280, Wi-Fi at 242). Once the
        // person ⌘-drags the item, macOS keeps their choice under the same key.
        let defaults = NSUserDefaults::standardUserDefaults();
        let key = NSString::from_str("NSStatusItem Preferred Position GropiusTimer");
        if defaults.objectForKey(&key).is_none() {
            defaults.setDouble_forKey(300.0, &key);
        }
        item.setAutosaveName(Some(&NSString::from_str("GropiusTimer")));
        let Some(button) = item.button(mtm) else { return };
        let size = button.font().map(|font| font.pointSize()).unwrap_or_else(NSFont::systemFontSize);
        let font = NSFont::monospacedDigitSystemFontOfSize_weight(size, unsafe { NSFontWeightRegular });
        button.setFont(Some(&font));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clock_rounds_up_and_grows_past_an_hour() {
        assert_eq!(clock(1_453_001), "24:14");
        assert_eq!(clock(60_000), "1:00");
        assert_eq!(clock(1), "0:01");
        assert_eq!(clock(0), "0:00");
        assert_eq!(clock(3_900_000), "1:05:00");
    }

    #[test]
    fn truncates_long_task_lines() {
        let line = truncate("Task: GRP-12 Validate supplier documents against the demo purchase", 44);
        assert_eq!(line.chars().count(), 44);
        assert!(line.ends_with('…'));
    }
}
