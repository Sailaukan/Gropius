pub mod contexts;
pub mod projects;
pub mod sessions;
pub mod settings;
pub mod tasks;

use crate::error::AppResult;
use rusqlite::Connection;
use std::path::Path;
use std::sync::{Mutex, MutexGuard};

/// Each entry moves the schema one version up; PRAGMA user_version records how many have run.
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

/// Deleted rows stay this long so a delete can be undone, then they are purged at launch.
const PURGE_AFTER_MS: i64 = 30 * 24 * 60 * 60 * 1000;

/// The one connection. Rust is the only writer: the board, the capture window and the timer all go through it.
pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> AppResult<Self> {
        Self::init(Connection::open(path)?)
    }

    #[cfg(test)]
    pub fn in_memory() -> AppResult<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(mut conn: Connection) -> AppResult<Self> {
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        migrate(&mut conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    pub fn lock(&self) -> MutexGuard<'_, Connection> {
        // A panic mid-statement leaves nothing half done (SQLite rolls back), so a poisoned lock is still usable.
        self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn migrate(conn: &mut Connection) -> AppResult<()> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(version as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as i64 + 1)?;
        tx.commit()?;
    }
    Ok(())
}

/// Housekeeping at launch: purge rows deleted long ago and close sessions a quit left open.
pub fn on_launch(conn: &Connection, now: i64) -> AppResult<()> {
    let cutoff = now - PURGE_AFTER_MS;
    conn.execute("DELETE FROM tasks WHERE deleted_at < ?1", [cutoff])?;
    conn.execute("DELETE FROM projects WHERE deleted_at < ?1", [cutoff])?;
    conn.execute("DELETE FROM contexts WHERE deleted_at < ?1", [cutoff])?;
    sessions::close_dangling(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_once_and_seeds_contexts() {
        let db = Db::in_memory().unwrap();
        let mut conn = db.lock();
        let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
        migrate(&mut conn).unwrap();
        let contexts: i64 = conn.query_row("SELECT count(*) FROM contexts", [], |r| r.get(0)).unwrap();
        assert_eq!(contexts, 4);
    }
}
