import type Database from 'better-sqlite3';
import type { Bookmark } from '../../shared/types';
import type { BookmarkItem } from '../../shared/bookmarks-html';
import { escapeLike } from './history-query';

const COLS = 'id, title, url, folder, favicon, created_at AS createdAt';
const isHttp = (u: string) => /^https?:\/\//i.test(u);

export class BookmarksRepo {
  constructor(private db: Database.Database) {}

  list(search?: string): Bookmark[] {
    if (search && search.trim()) {
      const like = `%${escapeLike(search.trim())}%`;
      return this.db
        .prepare(`SELECT ${COLS} FROM bookmarks WHERE title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\' ORDER BY created_at DESC`)
        .all(like, like) as Bookmark[];
    }
    return this.db.prepare(`SELECT ${COLS} FROM bookmarks ORDER BY created_at DESC`).all() as Bookmark[];
  }
  has(url: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM bookmarks WHERE url = ?').get(url);
  }
  add(b: { title: string; url: string; folder?: string; favicon?: string | null }): void {
    if (!isHttp(b.url)) throw new Error('Only http/https bookmarks are supported');
    this.db
      .prepare('INSERT OR IGNORE INTO bookmarks(title,url,folder,favicon,created_at) VALUES (?,?,?,?,?)')
      .run(b.title.trim().slice(0, 300) || b.url, b.url, (b.folder ?? '').trim().slice(0, 120), b.favicon ?? null, Date.now());
  }
  update(id: number, b: { title: string; url: string; folder: string }): void {
    if (!isHttp(b.url)) throw new Error('Only http/https bookmarks are supported');
    this.db.prepare('UPDATE bookmarks SET title=?, url=?, folder=? WHERE id=?')
      .run(b.title.trim().slice(0, 300) || b.url, b.url, b.folder.trim().slice(0, 120), id);
  }
  remove(id: number) { this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id); }
  removeByUrl(url: string) { this.db.prepare('DELETE FROM bookmarks WHERE url = ?').run(url); }
  importMany(items: BookmarkItem[]): number {
    let n = 0;
    const stmt = this.db.prepare('INSERT OR IGNORE INTO bookmarks(title,url,folder,favicon,created_at) VALUES (?,?,?,?,?)');
    this.db.transaction(() => {
      for (const b of items) n += stmt.run(b.title.slice(0, 300), b.url, b.folder.slice(0, 120), null, b.createdAt).changes;
    })();
    return n;
  }
}
