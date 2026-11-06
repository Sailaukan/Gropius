//! What the windows can ask of Rust. Every change commits, then tells every window, so the board, the capture box
//! and the menu bar stay in step.

pub mod app;
pub mod pomodoro;
pub mod projects;
pub mod tasks;

use crate::models::{Task, TasksChanged};
use tauri::{AppHandle, Emitter};

fn tasks_changed(app: &AppHandle, upserted: Vec<Task>, deleted: Vec<i64>) {
    let _ = app.emit("tasks:changed", TasksChanged { upserted, deleted });
}
