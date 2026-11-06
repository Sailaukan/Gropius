use crate::models::Status;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

/// Every setting the app has. Stored one key per row; a missing row takes the default here, so new settings need no
/// migration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    // Board
    pub visible_columns: Vec<Status>,
    pub show_empty_columns: bool,
    /// How many days of Done and Cancelled tasks the board shows; None shows all.
    pub completed_days: Option<u32>,
    /// A soft limit for In progress; 0 turns the hint off.
    pub wip_limit: u32,
    /// Todo and In progress tasks with no activity for this many days count as stalled in the weekly review.
    pub stalled_days: u32,

    // Pomodoro
    pub focus_minutes: u32,
    pub short_break_minutes: u32,
    pub long_break_minutes: u32,
    pub long_break_every: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
    pub move_to_in_progress: bool,
    pub sound_enabled: bool,
    pub show_time_in_menu_bar: bool,

    // General
    pub theme: Theme,
    pub capture_shortcut: String,
    /// 0 is Sunday, 1 is Monday.
    pub week_starts_on: u8,
    pub last_review_at: Option<i64>,
    pub sidebar_collapsed: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            visible_columns: vec![Status::Backlog, Status::Todo, Status::InProgress, Status::Done],
            show_empty_columns: true,
            completed_days: Some(14),
            wip_limit: 3,
            stalled_days: 7,
            focus_minutes: 25,
            short_break_minutes: 5,
            long_break_minutes: 15,
            long_break_every: 4,
            auto_start_breaks: true,
            auto_start_focus: false,
            move_to_in_progress: true,
            sound_enabled: true,
            show_time_in_menu_bar: true,
            theme: Theme::System,
            capture_shortcut: "Alt+Shift+Space".into(),
            week_starts_on: 1,
            last_review_at: None,
            sidebar_collapsed: false,
        }
    }
}

impl Settings {
    /// Keeps numbers inside the ranges the settings screen offers, whatever a caller sends.
    pub fn clamp(mut self) -> Self {
        self.wip_limit = self.wip_limit.min(20);
        self.stalled_days = self.stalled_days.clamp(3, 30);
        self.focus_minutes = self.focus_minutes.clamp(1, 90);
        self.short_break_minutes = self.short_break_minutes.clamp(1, 30);
        self.long_break_minutes = self.long_break_minutes.clamp(1, 60);
        self.long_break_every = self.long_break_every.clamp(2, 8);
        self.week_starts_on = self.week_starts_on.min(1);
        self.visible_columns.dedup();
        self
    }
}
