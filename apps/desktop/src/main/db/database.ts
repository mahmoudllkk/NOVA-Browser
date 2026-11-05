import Database from 'better-sqlite3';
import { seedDefaultShortcuts } from './shortcuts';

type Migration = string | ((db: Database.Database) => void);

// كل عنصر هنا = نسخة (version) من الـ schema. متعدلش عنصر قديم، ضيف عنصر جديد في الآخر.
const MIGRATIONS: Migration[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    hostname TEXT NOT NULL,
    domain TEXT NOT NULL,
    favicon TEXT,
    visited_at INTEGER NOT NULL
  );
  CREATE INDEX idx_visits_time ON visits(visited_at DESC);
  CREATE INDEX idx_visits_domain_time ON visits(domain, visited_at DESC);
  CREATE INDEX idx_visits_url ON visits(url);
  CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    folder TEXT NOT NULL DEFAULT '',
    favicon TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE search_engines (id TEXT PRIMARY KEY, name TEXT NOT NULL, url_template TEXT NOT NULL);
  INSERT INTO search_engines VALUES
    ('google', 'Google', 'https://www.google.com/search?q=%s'),
    ('bing', 'Bing', 'https://www.bing.com/search?q=%s'),
    ('duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/?q=%s');
  CREATE TABLE shortcuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    sequence TEXT NOT NULL,
    open_in TEXT NOT NULL DEFAULT 'new',
    enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE permissions (
    origin TEXT NOT NULL, permission TEXT NOT NULL, decision TEXT NOT NULL,
    PRIMARY KEY (origin, permission)
  );
  CREATE TABLE downloads (
    id TEXT PRIMARY KEY, filename TEXT NOT NULL, url TEXT NOT NULL, path TEXT NOT NULL,
    state TEXT NOT NULL, received INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL
  );
  `,
  (db) => seedDefaultShortcuts(db)
];

export function openDatabase(file: string): Database.Database {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const m = MIGRATIONS[v];
    db.transaction(() => {
      if (typeof m === 'string') db.exec(m);
      else m(db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    })();
  }
  return db;
}
