import { pool, query } from './db';

const schemaStatements = [
  // 1. Users table
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY,
    display_name VARCHAR NOT NULL,
    is_guest BOOLEAN DEFAULT TRUE,
    avatar_color VARCHAR DEFAULT '#6366f1',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  // 2. Rooms table
  `CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR PRIMARY KEY,
    host_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR NOT NULL,
    video_provider VARCHAR DEFAULT 'youtube',
    video_id VARCHAR NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    passcode VARCHAR,
    is_locked BOOLEAN DEFAULT FALSE,
    max_participants INTEGER DEFAULT 3,
    theme VARCHAR DEFAULT 'obsidian',
    status VARCHAR DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
  );`,

  // 3. Room Members table
  `CREATE TABLE IF NOT EXISTS room_members (
    id VARCHAR PRIMARY KEY,
    room_id VARCHAR REFERENCES rooms(id) ON DELETE CASCADE,
    user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
    guest_name VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'guest',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  // 4. Room Messages table
  `CREATE TABLE IF NOT EXISTS room_messages (
    id VARCHAR PRIMARY KEY,
    room_id VARCHAR REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id VARCHAR NOT NULL,
    sender_name VARCHAR NOT NULL,
    sender_role VARCHAR DEFAULT 'guest',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  // 5. Video Queue table
  `CREATE TABLE IF NOT EXISTS video_queue (
    id VARCHAR PRIMARY KEY,
    room_id VARCHAR REFERENCES rooms(id) ON DELETE CASCADE,
    video_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    thumbnail_url TEXT,
    added_by VARCHAR NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  // 6. Subscriptions table
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR NOT NULL DEFAULT 'free',
    status VARCHAR NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  // Indexes for fast lookups
  `CREATE INDEX IF NOT EXISTS idx_rooms_host ON rooms(host_id);`,
  `CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);`,
  `CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_video_queue_room ON video_queue(room_id, position);`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);`,

  // Serverless sync columns & WebRTC signaling
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_state JSONB;`,
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_call_active BOOLEAN DEFAULT FALSE;`,
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS call_host_name VARCHAR;`,
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS call_participants JSONB DEFAULT '[]'::jsonb;`,
  `CREATE TABLE IF NOT EXISTS room_signals (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id VARCHAR NOT NULL,
    recipient_id VARCHAR,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_room_signals ON room_signals(room_id, created_at);`,
];

export async function runMigrations() {
  console.log('[Migration] Checking and migrating schema on database...');
  for (const stmt of schemaStatements) {
    await query(stmt);
  }
  console.log('[Migration] Schema migration completed successfully.');
}

if (require.main === module || process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => {
      console.log('[Migration] All tables verified.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}
