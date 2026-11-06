use crate::error::{AppError, AppResult};
use crate::models::{Project, ProjectPatch};
use rusqlite::{Connection, params};

pub fn list(conn: &Connection) -> AppResult<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, outcome, created_at, completed_at FROM projects WHERE deleted_at IS NULL \
         ORDER BY name COLLATE NOCASE",
    )?;
    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                outcome: row.get(2)?,
                created_at: row.get(3)?,
                completed_at: row.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(projects)
}

pub fn create(conn: &Connection, name: &str, outcome: &str, now: i64) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO projects (name, outcome, created_at) VALUES (?1, ?2, ?3)",
        params![clean_name(name)?, outcome.trim(), now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, patch: ProjectPatch, now: i64) -> AppResult<()> {
    if let Some(name) = &patch.name {
        conn.execute("UPDATE projects SET name = ?2 WHERE id = ?1", params![id, clean_name(name)?])?;
    }
    if let Some(outcome) = &patch.outcome {
        conn.execute("UPDATE projects SET outcome = ?2 WHERE id = ?1", params![id, outcome.trim()])?;
    }
    if let Some(completed) = patch.completed {
        conn.execute("UPDATE projects SET completed_at = ?2 WHERE id = ?1", params![id, completed.then_some(now)])?;
    }
    Ok(())
}

/// Soft delete: the project leaves every list, its tasks keep the link so Undo can bring it back.
pub fn delete(conn: &Connection, id: i64, now: i64) -> AppResult<()> {
    conn.execute("UPDATE projects SET deleted_at = ?2 WHERE id = ?1", params![id, now])?;
    Ok(())
}

pub fn restore(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("UPDATE projects SET deleted_at = NULL WHERE id = ?1", [id])?;
    Ok(())
}

fn clean_name(name: &str) -> AppResult<String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() {
        return Err(AppError::Invalid("Write a name for the project.".into()));
    }
    Ok(name)
}
