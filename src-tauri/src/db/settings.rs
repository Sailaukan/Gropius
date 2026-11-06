use crate::error::{AppError, AppResult};
use crate::settings::Settings;
use rusqlite::{Connection, params};
use serde_json::{Map, Value};

/// The stored rows laid over the defaults.
pub fn load(conn: &Connection) -> AppResult<Settings> {
    let mut merged = match serde_json::to_value(Settings::default())? {
        Value::Object(map) => map,
        _ => Map::new(),
    };
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    for row in stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))? {
        let (key, value) = row?;
        if merged.contains_key(&key) {
            merged.insert(key, serde_json::from_str(&value)?);
        }
    }
    // A stored value that no longer fits its field falls back to the default rather than failing the launch.
    Ok(serde_json::from_value::<Settings>(Value::Object(merged))
        .unwrap_or_else(|_| Settings::default())
        .clamp())
}

/// Applies a partial update, such as {"focusMinutes": 30}, and returns the result.
pub fn update(conn: &Connection, patch: Map<String, Value>) -> AppResult<Settings> {
    let current = serde_json::to_value(load(conn)?)?;
    let Value::Object(mut merged) = current else { unreachable!("settings serialize to an object") };
    for (key, value) in &patch {
        if !merged.contains_key(key) {
            return Err(AppError::Invalid(format!("There is no setting called {key}.")));
        }
        merged.insert(key.clone(), value.clone());
    }
    let settings = serde_json::from_value::<Settings>(Value::Object(merged))
        .map_err(|e| AppError::Invalid(format!("That setting has the wrong kind of value: {e}")))?
        .clamp();

    // Store what the clamp kept, for the keys the patch named.
    let stored = serde_json::to_value(&settings)?;
    let mut upsert = conn.prepare(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    )?;
    for key in patch.keys() {
        upsert.execute(params![key, stored[key].to_string()])?;
    }
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use serde_json::json;

    fn patch(value: Value) -> Map<String, Value> {
        value.as_object().unwrap().clone()
    }

    #[test]
    fn stores_only_what_changed_and_clamps() {
        let db = Db::in_memory().unwrap();
        let conn = db.lock();
        let settings = update(&conn, patch(json!({"focusMinutes": 500, "theme": "dark"}))).unwrap();
        assert_eq!(settings.focus_minutes, 90);
        let loaded = load(&conn).unwrap();
        assert_eq!((loaded.focus_minutes, loaded.short_break_minutes), (90, 5));
        assert!(update(&conn, patch(json!({"nope": 1}))).is_err());
        assert!(update(&conn, patch(json!({"theme": "purple"}))).is_err());
    }
}
