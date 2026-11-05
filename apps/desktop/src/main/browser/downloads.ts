import { app, shell, type DownloadItem, type Session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { broadcast } from '../context';
import type { DownloadEntry } from '../../shared/types';

function uniquePath(dir: string, filename: string): string {
  const safe = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'download';
  const ext = path.extname(safe);
  const base = path.basename(safe, ext);
  let candidate = path.join(dir, safe);
  for (let i = 1; fs.existsSync(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
  return candidate;
}

export class DownloadManager {
  private items = new Map<string, DownloadEntry>();
  private handles = new Map<string, DownloadItem>();
  private lastEmit = 0;

  constructor(private db: Database.Database) {
    const rows = db.prepare('SELECT * FROM downloads ORDER BY started_at DESC LIMIT 200').all() as Array<{
      id: string; filename: string; url: string; path: string; state: string; received: number; total: number; started_at: number;
    }>;
    for (const r of rows) {
      const state = r.state === 'completed' || r.state === 'cancelled' ? r.state : 'interrupted';
      this.items.set(r.id, { id: r.id, filename: r.filename, url: r.url, path: r.path, state, received: r.received, total: r.total, startedAt: r.started_at, isPrivate: false });
    }
  }

  list(): DownloadEntry[] {
    return [...this.items.values()].sort((a, b) => b.startedAt - a.startedAt);
  }
  private emit(force = false) {
    const now = Date.now();
    if (!force && now - this.lastEmit < 250) return;
    this.lastEmit = now;
    broadcast('nova:downloads', this.list());
  }
  private persist(e: DownloadEntry) {
    if (e.isPrivate) return;
    this.db.prepare(
      `INSERT INTO downloads(id,filename,url,path,state,received,total,started_at) VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET state=excluded.state, received=excluded.received, total=excluded.total`
    ).run(e.id, e.filename, e.url, e.path, e.state, e.received, e.total, e.startedAt);
  }

  attach(ses: Session, isPrivate: boolean) {
    ses.on('will-download', (_event, item) => {
      const id = randomUUID();
      const savePath = uniquePath(app.getPath('downloads'), item.getFilename());
      item.setSavePath(savePath);
      const entry: DownloadEntry = {
        id, filename: path.basename(savePath), url: item.getURL(), path: savePath, state: 'progressing',
        received: 0, total: item.getTotalBytes(), startedAt: Date.now(), isPrivate
      };
      this.items.set(id, entry);
      this.handles.set(id, item);
      this.emit(true);
      item.on('updated', (_e, state) => {
        entry.received = item.getReceivedBytes();
        entry.total = item.getTotalBytes();
        entry.state = state === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing';
        this.emit();
      });
      item.once('done', (_e, state) => {
        entry.received = item.getReceivedBytes();
        entry.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';
        this.handles.delete(id);
        this.persist(entry);
        this.emit(true);
      });
    });
  }

  pause(id: string) { this.handles.get(id)?.pause(); }
  resume(id: string) { const h = this.handles.get(id); if (h?.canResume()) h.resume(); }
  cancel(id: string) { this.handles.get(id)?.cancel(); }
  open(id: string) {
    const e = this.items.get(id);
    if (e && e.state === 'completed' && fs.existsSync(e.path)) void shell.openPath(e.path);
  }
  show(id: string) {
    const e = this.items.get(id);
    if (e && fs.existsSync(e.path)) shell.showItemInFolder(e.path);
  }
  remove(id: string) {
    this.handles.get(id)?.cancel();
    this.items.delete(id);
    this.db.prepare('DELETE FROM downloads WHERE id = ?').run(id);
    this.emit(true);
  }
  clearFinished() {
    for (const [id, e] of this.items) if (e.state !== 'progressing' && e.state !== 'paused') this.items.delete(id);
    this.db.prepare("DELETE FROM downloads WHERE state != 'progressing'").run();
    this.emit(true);
  }
}
