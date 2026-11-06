use crate::error::AppResult;
use crate::models::Session;
use rusqlite::{Connection, params};

pub fn start(conn: &Connection, task: Option<i64>, phase: &str, planned_ms: i64, at: i64) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO pomodoro_sessions (task_id, phase, planned_ms, started_at) VALUES (?1, ?2, ?3, ?4)",
        params![task, phase, planned_ms, at],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn finish(conn: &Connection, id: i64, completed: bool, at: i64) -> AppResult<Option<i64>> {
    conn.execute(
        "UPDATE pomodoro_sessions SET ended_at = ?2, completed = ?3 WHERE id = ?1 AND ended_at IS NULL",
        params![id, at, completed],
    )?;
    Ok(conn.query_row("SELECT task_id FROM pomodoro_sessions WHERE id = ?1", [id], |row| row.get(0))?)
}

pub fn set_task(conn: &Connection, id: i64, task: Option<i64>) -> AppResult<()> {
    conn.execute("UPDATE pomodoro_sessions SET task_id = ?2 WHERE id = ?1", params![id, task])?;
    Ok(())
}

/// A session still open at launch was cut short by a quit: it ends where it started and does not count.
pub fn close_dangling(conn: &Connection) -> AppResult<()> {
    conn.execute("UPDATE pomodoro_sessions SET ended_at = started_at, completed = 0 WHERE ended_at IS NULL", [])?;
    Ok(())
}

pub fn for_task(conn: &Connection, task: i64) -> AppResult<Vec<Session>> {
    let mut stmt = conn.prepare(
        "SELECT id, task_id, phase, planned_ms, started_at, ended_at, completed FROM pomodoro_sessions \
         WHERE task_id = ?1 AND phase = 'focus' AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 100",
    )?;
    let sessions = stmt
        .query_map([task], |row| {
            Ok(Session {
                id: row.get(0)?,
                task_id: row.get(1)?,
                phase: row.get(2)?,
                planned_ms: row.get(3)?,
                started_at: row.get(4)?,
                ended_at: row.get(5)?,
                completed: row.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(sessions)
}

/// Finished focus sessions since a moment, such as local midnight, which the caller works out.
pub fn completed_focus_since(conn: &Connection, since: i64) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT count(*) FROM pomodoro_sessions WHERE phase = 'focus' AND completed = 1 AND ended_at >= ?1",
        [since],
        |row| row.get(0),
    )?)
}
