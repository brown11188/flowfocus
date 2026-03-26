const Database = require('better-sqlite3');
const db = new Database('./data/app.db');
try {
  db.exec("ALTER TABLE User ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'");
  console.log('Migration OK: timezone column added');
} catch (e) {
  if (e.message && e.message.includes('duplicate column')) {
    console.log('Column already exists, skipping.');
  } else {
    throw e;
  }
}
