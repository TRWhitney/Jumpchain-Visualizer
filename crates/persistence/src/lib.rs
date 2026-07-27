//! `SQLite` repository boundary for the desktop profile.

use std::path::Path;

use rusqlite::{Connection, OptionalExtension, params};

/// SQLite-backed versioned application aggregate storage.
pub struct AggregateStore {
    connection: Connection,
}

impl AggregateStore {
    /// Opens the database and applies deterministic schema migrations.
    ///
    /// # Errors
    ///
    /// Returns a `SQLite` error when the database cannot be opened or migrated.
    pub fn open(path: impl AsRef<Path>) -> rusqlite::Result<Self> {
        let connection = Connection::open(path)?;
        let store = Self { connection };
        store.migrate()?;
        Ok(store)
    }

    /// Creates a migrated in-memory store for tests and disposable sessions.
    ///
    /// # Errors
    ///
    /// Returns a `SQLite` error when the in-memory database cannot be migrated.
    pub fn in_memory() -> rusqlite::Result<Self> {
        let connection = Connection::open_in_memory()?;
        let store = Self { connection };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> rusqlite::Result<()> {
        self.connection.execute_batch(
            "BEGIN;
             CREATE TABLE IF NOT EXISTS application_aggregates (
               aggregate_key TEXT PRIMARY KEY NOT NULL,
               schema_version INTEGER NOT NULL,
               payload TEXT NOT NULL,
               updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             PRAGMA user_version = 1;
             COMMIT;",
        )
    }

    /// Loads one aggregate JSON payload.
    ///
    /// # Errors
    ///
    /// Returns a `SQLite` error when the aggregate query fails.
    pub fn load(&self, key: &str) -> rusqlite::Result<Option<String>> {
        self.connection
            .query_row(
                "SELECT payload FROM application_aggregates WHERE aggregate_key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
    }

    /// Atomically stores one aggregate JSON payload and schema version.
    ///
    /// # Errors
    ///
    /// Returns a `SQLite` error when the transaction cannot be written or committed.
    pub fn save(&mut self, key: &str, schema_version: u32, payload: &str) -> rusqlite::Result<()> {
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO application_aggregates (aggregate_key, schema_version, payload, updated_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
             ON CONFLICT(aggregate_key) DO UPDATE SET
               schema_version = excluded.schema_version,
               payload = excluded.payload,
               updated_at = CURRENT_TIMESTAMP",
            params![key, schema_version, payload],
        )?;
        transaction.commit()
    }

    /// Removes one aggregate payload when disposable state is no longer needed.
    ///
    /// # Errors
    ///
    /// Returns a `SQLite` error when the delete cannot be committed.
    pub fn remove(&mut self, key: &str) -> rusqlite::Result<()> {
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "DELETE FROM application_aggregates WHERE aggregate_key = ?1",
            params![key],
        )?;
        transaction.commit()
    }
}

#[cfg(test)]
mod tests {
    use super::AggregateStore;

    #[test]
    fn migrates_and_round_trips_versioned_aggregates() {
        let mut store = AggregateStore::in_memory().expect("in-memory database");
        assert_eq!(store.load("settings").expect("initial load"), None);
        store
            .save("settings", 1, r#"{"schemaVersion":1}"#)
            .expect("save settings");
        assert_eq!(
            store.load("settings").expect("saved load").as_deref(),
            Some(r#"{"schemaVersion":1}"#)
        );
        store
            .save("settings", 1, r#"{"schemaVersion":1,"changed":true}"#)
            .expect("update settings");
        assert_eq!(
            store.load("settings").expect("updated load").as_deref(),
            Some(r#"{"schemaVersion":1,"changed":true}"#)
        );
        store.remove("settings").expect("remove settings");
        assert_eq!(store.load("settings").expect("removed load"), None);
    }
}
