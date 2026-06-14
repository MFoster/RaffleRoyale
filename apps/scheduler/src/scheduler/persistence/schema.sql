CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  runAt TEXT NOT NULL,
  payload TEXT NOT NULL,
  targetQueueUrl TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'scheduled',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_run_at ON schedules(runAt);
CREATE INDEX IF NOT EXISTS idx_schedules_state_run_at ON schedules(state, runAt);
