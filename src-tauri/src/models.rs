use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use serde::{Deserialize, Deserializer, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> i64 {
    to_ms(SystemTime::now())
}

pub fn to_ms(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

/// Tells a missing field (None) from an explicit null (Some(None)) in a patch.
pub fn double_opt<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Backlog,
    Todo,
    InProgress,
    Done,
    Cancelled,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Status::Backlog => "backlog",
            Status::Todo => "todo",
            Status::InProgress => "in_progress",
            Status::Done => "done",
            Status::Cancelled => "cancelled",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "backlog" => Status::Backlog,
            "todo" => Status::Todo,
            "in_progress" => Status::InProgress,
            "done" => Status::Done,
            "cancelled" => Status::Cancelled,
            _ => return None,
        })
    }
}

impl ToSql for Status {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        Ok(self.as_str().into())
    }
}

impl FromSql for Status {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        Status::parse(value.as_str()?).ok_or(FromSqlError::InvalidType)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub seq: i64,
    pub title: String,
    pub description: String,
    pub status: Status,
    pub sort_order: f64,
    pub priority: i64,
    pub project_id: Option<i64>,
    pub context_ids: Vec<i64>,
    pub due_date: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub activity_at: i64,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub cancelled_at: Option<i64>,
    pub processed_at: Option<i64>,
    pub reviewed_at: Option<i64>,
    pub pomodoros_completed: i64,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTask {
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub status: Option<Status>,
    #[serde(default)]
    pub priority: i64,
    pub project_id: Option<i64>,
    #[serde(default)]
    pub context_ids: Vec<i64>,
    pub due_date: Option<String>,
    /// False for quick capture: the task waits in the inbox until it is processed.
    #[serde(default = "yes")]
    pub processed: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPatch {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<Status>,
    pub priority: Option<i64>,
    #[serde(default, deserialize_with = "double_opt")]
    pub project_id: Option<Option<i64>>,
    pub context_ids: Option<Vec<i64>>,
    #[serde(default, deserialize_with = "double_opt")]
    pub due_date: Option<Option<String>>,
    /// Takes the task out of the inbox.
    #[serde(default)]
    pub processed: bool,
    /// Stamps reviewed_at, for the weekly review.
    #[serde(default)]
    pub reviewed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub outcome: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPatch {
    pub name: Option<String>,
    pub outcome: Option<String>,
    pub completed: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Context {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: i64,
    pub task_id: Option<i64>,
    pub phase: String,
    pub planned_ms: i64,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub completed: bool,
}

/// What every window hears after tasks change.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TasksChanged {
    pub upserted: Vec<Task>,
    pub deleted: Vec<i64>,
}
