-- Times are UTC milliseconds since the epoch. due_date is a local calendar day, YYYY-MM-DD.

CREATE TABLE meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL) WITHOUT ROWID;
INSERT INTO meta (key, value) VALUES ('task_seq', 0);

CREATE TABLE projects (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
  outcome      TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  completed_at INTEGER,
  deleted_at   INTEGER
);

CREATE TABLE contexts (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (name GLOB '@?*'),
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
INSERT INTO contexts (name, created_at)
SELECT name, CAST(unixepoch('subsec') * 1000 AS INTEGER)
FROM (SELECT '@computer' AS name UNION ALL SELECT '@home' UNION ALL SELECT '@errands' UNION ALL SELECT '@calls');

CREATE TABLE tasks (
  id                  INTEGER PRIMARY KEY,
  seq                 INTEGER NOT NULL UNIQUE,
  title               TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description         TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'backlog'
                      CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'cancelled')),
  sort_order          REAL NOT NULL,
  priority            INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4), -- none, urgent, high, medium, low
  project_id          INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  due_date            TEXT CHECK (due_date IS NULL OR date(due_date) = due_date),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  activity_at         INTEGER NOT NULL, -- last edit, move, finished focus session or review decision
  started_at          INTEGER,
  completed_at        INTEGER,
  cancelled_at        INTEGER,
  processed_at        INTEGER,          -- null while the task waits in the inbox
  reviewed_at         INTEGER,
  deleted_at          INTEGER,
  pomodoros_completed INTEGER NOT NULL DEFAULT 0 CHECK (pomodoros_completed >= 0)
);
CREATE INDEX idx_tasks_board ON tasks (status, sort_order);
CREATE INDEX idx_tasks_project ON tasks (project_id);

CREATE TABLE task_contexts (
  task_id    INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  context_id INTEGER NOT NULL REFERENCES contexts (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, context_id)
) WITHOUT ROWID;
CREATE INDEX idx_task_contexts_context ON task_contexts (context_id);

CREATE TABLE pomodoro_sessions (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER REFERENCES tasks (id) ON DELETE SET NULL,
  phase      TEXT NOT NULL CHECK (phase IN ('focus', 'short_break', 'long_break')),
  planned_ms INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,
  completed  INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1))
);
CREATE INDEX idx_sessions_task ON pomodoro_sessions (task_id);
CREATE INDEX idx_sessions_started ON pomodoro_sessions (started_at);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK (json_valid(value))) WITHOUT ROWID;
