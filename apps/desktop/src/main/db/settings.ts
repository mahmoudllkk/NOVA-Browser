import type Database from 'better-sqlite3';
import { DEFAULT_SETTINGS, type PermissionRow, type SearchEngine, type Settings } from '../../shared/types';
import { normalizeUserUrl } from '../../shared/url';

export class SettingsRepo {
  constructor(private db: Database.Database, private engines: EnginesRepo) {}

  getAll(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      if (r.key in DEFAULT_SETTINGS) {
        try { out[r.key] = JSON.parse(r.value); } catch { /* keep default */ }
      }
    }
    return out as unknown as Settings;
  }

  set(key: string, value: unknown): Settings {
    switch (key) {
      case 'theme':
        if (!['system', 'light', 'dark'].includes(value as string)) throw new Error('bad theme');
        break;
      case 'searchEngineId':
        if (typeof value !== 'string' || !this.engines.get(value)) throw new Error('unknown search engine');
        break;
      case 'homepage':
        if (typeof value !== 'string' || value.length > 2000) throw new Error('bad homepage');
        if (value !== '' && !normalizeUserUrl(value)) throw new Error('الصفحة الرئيسية لازم تكون رابط http/https صالح');
        value = value === '' ? '' : normalizeUserUrl(value);
        break;
      case 'shortcutTimeoutMs':
        if (!Number.isInteger(value) || (value as number) < 300 || (value as number) > 5000) throw new Error('timeout must be 300-5000');
        break;
      default:
        throw new Error('unknown setting');
    }
    this.db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, JSON.stringify(value));
    return this.getAll();
  }
}

export class EnginesRepo {
  constructor(private db: Database.Database) {}
  list(): SearchEngine[] {
    return this.db.prepare('SELECT id, name, url_template AS urlTemplate FROM search_engines ORDER BY rowid').all() as SearchEngine[];
  }
  get(id: string): SearchEngine | undefined {
    return this.db.prepare('SELECT id, name, url_template AS urlTemplate FROM search_engines WHERE id = ?').get(id) as SearchEngine | undefined;
  }
  add(name: string, urlTemplate: string): void {
    name = name.trim().slice(0, 40);
    if (!name) throw new Error('الاسم مطلوب');
    if (!urlTemplate.includes('%s')) throw new Error('الرابط لازم يحتوي على %s مكان كلمة البحث');
    if (!normalizeUserUrl(urlTemplate.replace('%s', 'test')) || !/^https?:\/\//i.test(urlTemplate)) {
      throw new Error('الرابط لازم يبدأ بـ http:// أو https://');
    }
    const id = 'custom-' + Date.now().toString(36);
    this.db.prepare('INSERT INTO search_engines(id,name,url_template) VALUES (?,?,?)').run(id, name, urlTemplate);
  }
  remove(id: string): void {
    if (this.list().length <= 1) throw new Error('لازم يفضل محرك بحث واحد على الأقل');
    this.db.prepare('DELETE FROM search_engines WHERE id = ?').run(id);
  }
}

export class PermissionsRepo {
  constructor(private db: Database.Database) {}
  get(origin: string, permission: string): 'allow' | 'deny' | undefined {
    const r = this.db.prepare('SELECT decision FROM permissions WHERE origin=? AND permission=?').get(origin, permission) as
      | { decision: 'allow' | 'deny' } | undefined;
    return r?.decision;
  }
  set(origin: string, permission: string, decision: 'allow' | 'deny') {
    this.db.prepare('INSERT INTO permissions(origin,permission,decision) VALUES (?,?,?) ON CONFLICT(origin,permission) DO UPDATE SET decision=excluded.decision')
      .run(origin, permission, decision);
  }
  list(): PermissionRow[] {
    return this.db.prepare('SELECT origin, permission, decision FROM permissions ORDER BY origin').all() as PermissionRow[];
  }
  remove(origin: string, permission: string) {
    this.db.prepare('DELETE FROM permissions WHERE origin=? AND permission=?').run(origin, permission);
  }
}
