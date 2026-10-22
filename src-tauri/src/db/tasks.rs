use crate::error::{AppError, AppResult};
use crate::models::{NewTask, Status, Task, TaskPatch};
use rusqlite::{Connection, OptionalExtension, Row, params};
use std::collections::HashMap;

/// The gap left between neighbours when a column is renumbered, and the step to the top or bottom of a column.
const STEP: f64 = 1024.0;
/// Below this gap two neighbours are renumbered before a task goes between them.
const MIN_GAP: f64 = 1e-6;

const COLUMNS: &str = "id, seq, title, description, status, sort_order, priority, project_id, due_date, created_at, \
    updated_at, activity_at, started_at, completed_at, cancelled_at, processed_at, reviewed_at, pomodoros_completed";

fn from_row(row: &Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        seq: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        status: row.get(4)?,
        sort_order: row.get(5)?,
        priority: row.get(6)?,
        project_id: row.get(7)?,
        context_ids: Vec::new(),
        due_date: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        activity_at: row.get(11)?,
        started_at: row.get(12)?,
        completed_at: row.get(13)?,
        cancelled_at: row.get(14)?,
        processed_at: row.get(15)?,
        reviewed_at: row.get(16)?,
        pomodoros_completed: row.get(17)?,
    })
}

/// Every task that is not deleted, with its contexts.
pub fn list(conn: &Connection) -> AppResult<Vec<Task>> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM tasks WHERE deleted_at IS NULL ORDER BY status, sort_order"))?;
    let mut tasks = stmt.query_map([], from_row)?.collect::<rusqlite::Result<Vec<_>>>()?;

    let mut contexts: HashMap<i64, Vec<i64>> = HashMap::new();
    let mut stmt = conn.prepare(
        "SELECT tc.task_id, tc.context_id FROM task_contexts tc JOIN contexts c ON c.id = tc.context_id \
         WHERE c.deleted_at IS NULL ORDER BY c.name",
    )?;
    for pair in stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))? {
        let (task, context) = pair?;
        contexts.entry(task).or_default().push(context);
    }
    for task in &mut tasks {
        task.context_ids = contexts.remove(&task.id).unwrap_or_default();
    }
    Ok(tasks)
}

/// One task, deleted or not.
pub fn get(conn: &Connection, id: i64) -> AppResult<Task> {
    let mut task = conn
        .query_row(&format!("SELECT {COLUMNS} FROM tasks WHERE id = ?1"), [id], from_row)
        .optional()?
        .ok_or(AppError::NotFound("Task"))?;
    let mut stmt = conn.prepare(
        "SELECT tc.context_id FROM task_contexts tc JOIN contexts c ON c.id = tc.context_id \
         WHERE tc.task_id = ?1 AND c.deleted_at IS NULL ORDER BY c.name",
    )?;
    task.context_ids = stmt.query_map([id], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(task)
}

pub fn create(conn: &Connection, input: NewTask, now: i64) -> AppResult<Task> {
    let title = clean_title(&input.title)?;
    check_priority(input.priority)?;
    check_due_date(input.due_date.as_deref())?;
    if let Some(project) = input.project_id {
        check_project(conn, project)?;
    }
    let status = input.status.unwrap_or(Status::Backlog);
    let seq: i64 = conn.query_row(
        "UPDATE meta SET value = value + 1 WHERE key = 'task_seq' RETURNING value",
        [],
        |row| row.get(0),
    )?;
    let processed_at = input.processed.then_some(now);
    conn.execute(
        "INSERT INTO tasks (seq, title, description, status, sort_order, priority, project_id, due_date, created_at, \
         updated_at, activity_at, started_at, completed_at, cancelled_at, processed_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?9, ?10, ?11, ?12, ?13)",
        params![
            seq,
            title,
            input.description,
            status,
            top_of(conn, status)?,
            input.priority,
            input.project_id,
            input.due_date,
            now,
            (status == Status::InProgress).then_some(now),
            (status == Status::Done).then_some(now),
            (status == Status::Cancelled).then_some(now),
            processed_at,
        ],
    )?;
    let id = conn.last_insert_rowid();
    set_contexts(conn, id, &input.context_ids)?;
    get(conn, id)
}

pub fn update(conn: &Connection, id: i64, patch: TaskPatch, now: i64) -> AppResult<Task> {
    let task = get(conn, id)?;
    if let Some(title) = &patch.title {
        conn.execute("UPDATE tasks SET title = ?2 WHERE id = ?1", params![id, clean_title(title)?])?;
    }
    if let Some(description) = &patch.description {
        conn.execute("UPDATE tasks SET description = ?2 WHERE id = ?1", params![id, description])?;
    }
    if let Some(priority) = patch.priority {
        check_priority(priority)?;
        conn.execute("UPDATE tasks SET priority = ?2 WHERE id = ?1", params![id, priority])?;
    }
    if let Some(project) = patch.project_id {
        if let Some(project) = project {
            check_project(conn, project)?;
        }
        conn.execute("UPDATE tasks SET project_id = ?2 WHERE id = ?1", params![id, project])?;
    }
    if let Some(due_date) = &patch.due_date {
        check_due_date(due_date.as_deref())?;
        conn.execute("UPDATE tasks SET due_date = ?2 WHERE id = ?1", params![id, due_date])?;
    }
    if let Some(contexts) = &patch.context_ids {
        set_contexts(conn, id, contexts)?;
    }
    if let Some(status) = patch.status
        && status != task.status
    {
        // A task that changes column lands on top of the new one.
        let order = top_of(conn, status)?;
        conn.execute("UPDATE tasks SET status = ?2, sort_order = ?3 WHERE id = ?1", params![id, status, order])?;
        stamp_status(conn, id, status, now)?;
    }
    if patch.processed {
        conn.execute("UPDATE tasks SET processed_at = coalesce(processed_at, ?2) WHERE id = ?1", params![id, now])?;
    }
    if patch.reviewed {
        conn.execute(
            "UPDATE tasks SET reviewed_at = ?2, processed_at = coalesce(processed_at, ?2) WHERE id = ?1",
            params![id, now],
        )?;
    }
    touch(conn, id, now)?;
    get(conn, id)
}

/// Moves a task between two neighbours in a column, the way a drag ends. prev is the task above it, next the task
/// below. Returns every task whose order changed.
pub fn move_to(
    conn: &Connection,
    id: i64,
    status: Status,
    prev: Option<i64>,
    next: Option<i64>,
    now: i64,
) -> AppResult<Vec<Task>> {
    let task = get(conn, id)?;
    let order_in = |neighbour: Option<i64>| -> AppResult<Option<f64>> {
        let Some(neighbour) = neighbour.filter(|n| *n != id) else { return Ok(None) };
        Ok(conn
            .query_row(
                "SELECT sort_order FROM tasks WHERE id = ?1 AND status = ?2 AND deleted_at IS NULL",
                params![neighbour, status],
                |row| row.get(0),
            )
            .optional()?)
    };

    let mut changed = vec![id];
    let (mut above, mut below) = (order_in(prev)?, order_in(next)?);
    if let (Some(a), Some(b)) = (above, below)
        && (b - a).abs() < MIN_GAP
    {
        changed.extend(rebalance(conn, status, id)?);
        above = order_in(prev)?;
        below = order_in(next)?;
    }
    let order = match (above, below) {
        (Some(a), Some(b)) => (a + b) / 2.0,
        (Some(a), None) => a + STEP,
        (None, Some(b)) => b - STEP,
        (None, None) => top_of(conn, status)?,
    };
    conn.execute("UPDATE tasks SET status = ?2, sort_order = ?3 WHERE id = ?1", params![id, status, order])?;
    if status != task.status {
        stamp_status(conn, id, status, now)?;
    }
    touch(conn, id, now)?;

    changed.sort_unstable();
    changed.dedup();
    changed.into_iter().map(|id| get(conn, id)).collect()
}

pub fn delete(conn: &Connection, id: i64, now: i64) -> AppResult<()> {
    let rows = conn.execute("UPDATE tasks SET deleted_at = ?2 WHERE id = ?1 AND deleted_at IS NULL", params![id, now])?;
    if rows == 0 {
        return Err(AppError::NotFound("Task"));
    }
    Ok(())
}

pub fn restore(conn: &Connection, id: i64) -> AppResult<Task> {
    conn.execute("UPDATE tasks SET deleted_at = NULL WHERE id = ?1", [id])?;
    get(conn, id)
}

/// Counts one finished focus session on the task.
pub fn add_pomodoro(conn: &Connection, id: i64, now: i64) -> AppResult<Task> {
    conn.execute("UPDATE tasks SET pomodoros_completed = pomodoros_completed + 1 WHERE id = ?1", [id])?;
    touch(conn, id, now)?;
    get(conn, id)
}

fn touch(conn: &Connection, id: i64, now: i64) -> AppResult<()> {
    conn.execute("UPDATE tasks SET updated_at = ?2, activity_at = ?2 WHERE id = ?1", params![id, now])?;
    Ok(())
}

/// The stamps a change of column sets: Done and Cancelled are stamped and unstamped, the first start is kept, and
/// any move counts as processing an inbox task.
fn stamp_status(conn: &Connection, id: i64, status: Status, now: i64) -> AppResult<()> {
    conn.execute(
        "UPDATE tasks SET \
           completed_at = CASE WHEN ?2 = 'done' THEN ?3 END, \
           cancelled_at = CASE WHEN ?2 = 'cancelled' THEN ?3 END, \
           started_at = coalesce(started_at, CASE WHEN ?2 = 'in_progress' THEN ?3 END), \
           processed_at = coalesce(processed_at, ?3) \
         WHERE id = ?1",
        params![id, status, now],
    )?;
    Ok(())
}

/// The order that puts a task above everything else in a column.
fn top_of(conn: &Connection, status: Status) -> AppResult<f64> {
    let min: Option<f64> = conn.query_row(
        "SELECT min(sort_order) FROM tasks WHERE status = ?1 AND deleted_at IS NULL",
        [status],
        |row| row.get(0),
    )?;
    Ok(min.map_or(0.0, |min| min - STEP))
}

/// Renumbers a column in even steps, leaving out the task being moved. Returns the ids it renumbered.
fn rebalance(conn: &Connection, status: Status, moving: i64) -> AppResult<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM tasks WHERE status = ?1 AND id != ?2 AND deleted_at IS NULL ORDER BY sort_order, id",
    )?;
    let ids: Vec<i64> = stmt.query_map(params![status, moving], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
    let mut update = conn.prepare("UPDATE tasks SET sort_order = ?2 WHERE id = ?1")?;
    for (index, id) in ids.iter().enumerate() {
        update.execute(params![id, (index as f64 + 1.0) * STEP])?;
    }
    Ok(ids)
}

fn set_contexts(conn: &Connection, id: i64, contexts: &[i64]) -> AppResult<()> {
    conn.execute("DELETE FROM task_contexts WHERE task_id = ?1", [id])?;
    let mut insert = conn.prepare(
        "INSERT OR IGNORE INTO task_contexts (task_id, context_id) \
         SELECT ?1, id FROM contexts WHERE id = ?2 AND deleted_at IS NULL",
    )?;
    for context in contexts {
        insert.execute(params![id, context])?;
    }
    Ok(())
}

fn clean_title(title: &str) -> AppResult<String> {
    let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if title.is_empty() {
        return Err(AppError::Invalid("Write a title for the task.".into()));
    }
    Ok(title)
}

fn check_priority(priority: i64) -> AppResult<()> {
    if !(0..=4).contains(&priority) {
        return Err(AppError::Invalid("Priority must be between 0 and 4.".into()));
    }
    Ok(())
}

fn check_due_date(date: Option<&str>) -> AppResult<()> {
    let Some(date) = date else { return Ok(()) };
    let parts: Vec<&str> = date.split('-').collect();
    let valid = matches!(parts.as_slice(), [y, m, d] if y.len() == 4 && m.len() == 2 && d.len() == 2
        && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())));
    if !valid {
        return Err(AppError::Invalid(format!("{date} is not a date in the form 2026-10-20.")));
    }
    Ok(())
}

fn check_project(conn: &Connection, id: i64) -> AppResult<()> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS (SELECT 1 FROM projects WHERE id = ?1 AND deleted_at IS NULL)",
        [id],
        |row| row.get(0),
    )?;
    if !exists {
        return Err(AppError::NotFound("Project"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn new(title: &str, status: Status) -> NewTask {
        NewTask { title: title.into(), status: Some(status), processed: true, ..Default::default() }
    }

    fn column_tasks(conn: &Connection, status: Status) -> Vec<Task> {
        let mut tasks: Vec<Task> = list(conn).unwrap().into_iter().filter(|t| t.status == status).collect();
        tasks.sort_by(|a, b| a.sort_order.total_cmp(&b.sort_order));
        tasks
    }

    fn column(conn: &Connection, status: Status) -> Vec<String> {
        column_tasks(conn, status).into_iter().map(|t| t.title).collect()
    }

    #[test]
    fn numbers_are_never_reused() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        let a = create(&conn, new("Book the car service", Status::Todo), 1).unwrap();
        delete(&conn, a.id, 2).unwrap();
        let b = create(&conn, new("Call Dana about the lease", Status::Todo), 3).unwrap();
        assert_eq!((a.seq, b.seq), (1, 2));
        assert_eq!(column(&conn, Status::Todo), ["Call Dana about the lease"]);
    }

    #[test]
    fn new_tasks_land_on_top() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        create(&conn, new("First", Status::Backlog), 1).unwrap();
        create(&conn, new("Second", Status::Backlog), 2).unwrap();
        assert_eq!(column(&conn, Status::Backlog), ["Second", "First"]);
    }

    #[test]
    fn moves_between_neighbours_and_stamps_status() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        let c = create(&conn, new("C", Status::Todo), 1).unwrap();
        let a = create(&conn, new("A", Status::Todo), 2).unwrap();
        let moving = create(&conn, new("B", Status::Backlog), 3).unwrap();
        assert!(moving.completed_at.is_none());

        move_to(&conn, moving.id, Status::Todo, Some(a.id), Some(c.id), 4).unwrap();
        assert_eq!(column(&conn, Status::Todo), ["A", "B", "C"]);

        let done = move_to(&conn, moving.id, Status::Done, None, None, 5).unwrap();
        assert_eq!(done[0].completed_at, Some(5));
        let back = move_to(&conn, moving.id, Status::InProgress, None, None, 6).unwrap();
        assert_eq!((back[0].completed_at, back[0].started_at), (None, Some(6)));
    }

    #[test]
    fn renumbers_a_column_when_the_gap_runs_out() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        create(&conn, new("Below", Status::Todo), 1).unwrap();
        let above = create(&conn, new("Above", Status::Todo), 2).unwrap();
        // Keep squeezing a task in right under Above: the gap halves each time, so it runs out and forces a renumber.
        for i in 0..60 {
            let task = create(&conn, new(&format!("T{i}"), Status::Backlog), 3).unwrap();
            let next = column_tasks(&conn, Status::Todo)[1].id;
            move_to(&conn, task.id, Status::Todo, Some(above.id), Some(next), 4).unwrap();
        }
        let titles = column(&conn, Status::Todo);
        assert_eq!(titles.len(), 62);
        assert_eq!(titles[..2], ["Above", "T59"]);
        assert_eq!(titles[60..], ["T0", "Below"]);
    }

    #[test]
    fn patch_tells_null_from_missing() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        let task = create(&conn, NewTask { due_date: Some("2026-10-24".into()), ..new("Renew passport", Status::Todo) }, 1)
            .unwrap();
        let patch: TaskPatch = serde_json::from_str(r#"{"priority": 2}"#).unwrap();
        let kept = update(&conn, task.id, patch, 2).unwrap();
        assert_eq!((kept.due_date.as_deref(), kept.priority), (Some("2026-10-24"), 2));
        let patch: TaskPatch = serde_json::from_str(r#"{"dueDate": null}"#).unwrap();
        assert_eq!(update(&conn, task.id, patch, 3).unwrap().due_date, None);
    }

    #[test]
    fn capture_waits_in_the_inbox_until_processed() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        let task = create(&conn, NewTask { title: "Fix the gate".into(), ..Default::default() }, 1).unwrap();
        assert_eq!((task.status, task.processed_at), (Status::Backlog, None));
        let patch = TaskPatch { reviewed: true, ..Default::default() };
        let task = update(&conn, task.id, patch, 2).unwrap();
        assert_eq!((task.processed_at, task.reviewed_at), (Some(2), Some(2)));
    }

    #[test]
    fn rejects_bad_input() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        assert!(create(&conn, new("   ", Status::Todo), 1).is_err());
        assert!(create(&conn, NewTask { priority: 9, ..new("Title", Status::Todo) }, 1).is_err());
        assert!(create(&conn, NewTask { due_date: Some("24/10/2026".into()), ..new("Title", Status::Todo) }, 1).is_err());
        assert!(create(&conn, NewTask { project_id: Some(42), ..new("Title", Status::Todo) }, 1).is_err());
    }
}
