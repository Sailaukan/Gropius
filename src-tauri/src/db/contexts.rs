use crate::error::{AppError, AppResult};
use crate::models::Context;
use rusqlite::{Connection, ErrorCode, OptionalExtension, params};

pub fn list(conn: &Connection) -> AppResult<Vec<Context>> {
    let mut stmt =
        conn.prepare("SELECT id, name FROM contexts WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE")?;
    let contexts = stmt
        .query_map([], |row| Ok(Context { id: row.get(0)?, name: row.get(1)? }))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(contexts)
}

/// Creates a context, or brings back a deleted one with the same name.
pub fn create(conn: &Connection, name: &str, now: i64) -> AppResult<i64> {
    let name = clean_name(name)?;
    let deleted: Option<i64> = conn
        .query_row("SELECT id FROM contexts WHERE name = ?1 AND deleted_at IS NOT NULL", [&name], |row| row.get(0))
        .optional()?;
    if let Some(id) = deleted {
        conn.execute("UPDATE contexts SET deleted_at = NULL WHERE id = ?1", [id])?;
        return Ok(id);
    }
    conn.execute("INSERT INTO contexts (name, created_at) VALUES (?1, ?2)", params![name, now])
        .map_err(|e| taken(e, &name))?;
    Ok(conn.last_insert_rowid())
}

pub fn rename(conn: &Connection, id: i64, name: &str) -> AppResult<()> {
    let name = clean_name(name)?;
    conn.execute("UPDATE contexts SET name = ?2 WHERE id = ?1", params![id, name]).map_err(|e| taken(e, &name))?;
    Ok(())
}

pub fn delete(conn: &Connection, id: i64, now: i64) -> AppResult<()> {
    conn.execute("UPDATE contexts SET deleted_at = ?2 WHERE id = ?1", params![id, now])?;
    Ok(())
}

pub fn restore(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("UPDATE contexts SET deleted_at = NULL WHERE id = ?1", [id])?;
    Ok(())
}

/// Contexts are one word that starts with @, such as @calls.
fn clean_name(name: &str) -> AppResult<String> {
    let word = name.trim().trim_start_matches('@').split_whitespace().collect::<Vec<_>>().join("-");
    if word.is_empty() {
        return Err(AppError::Invalid("Write a name for the context, such as @calls.".into()));
    }
    Ok(format!("@{}", word.to_lowercase()))
}

fn taken(error: rusqlite::Error, name: &str) -> AppError {
    match error.sqlite_error_code() {
        Some(ErrorCode::ConstraintViolation) => AppError::Invalid(format!("{name} already exists.")),
        _ => error.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn names_are_one_lowercase_word_with_an_at() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        let id = create(&conn, "Deep work", 1).unwrap();
        assert!(list(&conn).unwrap().iter().any(|c| c.id == id && c.name == "@deep-work"));
        assert!(create(&conn, "@Calls", 2).is_err());
    }

    #[test]
    fn creating_a_deleted_name_restores_it() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        let id = create(&conn, "@gym", 1).unwrap();
        delete(&conn, id, 2).unwrap();
        assert_eq!(create(&conn, "gym", 3).unwrap(), id);
    }
}
