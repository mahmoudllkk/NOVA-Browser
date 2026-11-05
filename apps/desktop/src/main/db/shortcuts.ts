import type Database from 'better-sqlite3';
import type { ShortcutRow, ShortcutSaveResult } from '../../shared/types';
import { findConflicts, validateSequence } from '../../shared/shortcut-engine';
import { normalizeUserUrl } from '../../shared/url';

export const DEFAULT_SHORTCUTS = [
  { name: 'YouTube', url: 'https://www.youtube.com/', sequence: ['Ctrl+Y', 'Y'] },
  { name: 'Facebook', url: 'https://www.facebook.com/', sequence: ['Ctrl+F', 'F'] },
  { name: 'Google', url: 'https://www.google.com/', sequence: ['Ctrl+G', 'G'] }
];

export function seedDefaultShortcuts(db: Database.Database) {
  const stmt = db.prepare("INSERT INTO shortcuts(name,url,sequence,open_in,enabled) VALUES (?,?,?,'new',1)");
  for (const s of DEFAULT_SHORTCUTS) stmt.run(s.name, s.url, JSON.stringify(s.sequence));
}

interface Row { id: number; name: string; url: string; sequence: string; open_in: string; enabled: number }

export class ShortcutsRepo {
  private cache: ShortcutRow[] | null = null;
  constructor(private db: Database.Database) {}

  list(): ShortcutRow[] {
    if (!this.cache) {
      const rows = this.db.prepare('SELECT * FROM shortcuts ORDER BY id').all() as Row[];
      this.cache = rows.map((r) => ({
        id: r.id, name: r.name, url: r.url, sequence: JSON.parse(r.sequence) as string[],
        openIn: r.open_in === 'current' ? 'current' : 'new', enabled: r.enabled === 1
      }));
    }
    return this.cache;
  }

  save(
    input: { id?: number; name: string; url: string; sequence: string[]; openIn: string; enabled: boolean },
    disableConflicting: boolean
  ): ShortcutSaveResult {
    const errors: string[] = [];
    const name = String(input.name ?? '').trim();
    if (!name || name.length > 60) errors.push('الاسم مطلوب (حتى 60 حرف)');
    const url = normalizeUserUrl(String(input.url ?? ''));
    if (!url) errors.push('الرابط لازم يكون http أو https صالح');
    const seqErr = validateSequence(input.sequence);
    if (seqErr) errors.push(seqErr);
    if (errors.length) return { ok: false, errors, conflicts: [] };

    const others = this.list().filter((s) => s.id !== input.id);
    const conflicts = input.enabled ? findConflicts(input.sequence, others) : [];
    if (conflicts.length && !disableConflicting) {
      return {
        ok: false,
        errors: ['الاختصار ده بيتعارض مع اختصارات تانية'],
        conflicts: conflicts.map((c) => ({ id: c.id, name: c.name }))
      };
    }
    const openIn = input.openIn === 'current' ? 'current' : 'new';
    let id = input.id ?? 0;
    this.db.transaction(() => {
      for (const c of conflicts) this.db.prepare('UPDATE shortcuts SET enabled = 0 WHERE id = ?').run(c.id);
      if (input.id) {
        this.db.prepare('UPDATE shortcuts SET name=?, url=?, sequence=?, open_in=?, enabled=? WHERE id=?')
          .run(name, url, JSON.stringify(input.sequence), openIn, input.enabled ? 1 : 0, input.id);
      } else {
        id = Number(this.db.prepare('INSERT INTO shortcuts(name,url,sequence,open_in,enabled) VALUES (?,?,?,?,?)')
          .run(name, url, JSON.stringify(input.sequence), openIn, input.enabled ? 1 : 0).lastInsertRowid);
      }
    })();
    this.cache = null;
    return { ok: true, id };
  }

  remove(id: number) { this.db.prepare('DELETE FROM shortcuts WHERE id = ?').run(id); this.cache = null; }

  toggle(id: number, enabled: boolean): ShortcutSaveResult {
    const s = this.list().find((x) => x.id === id);
    if (!s) return { ok: false, errors: ['الاختصار مش موجود'], conflicts: [] };
    return this.save({ ...s, enabled }, false);
  }

  restoreDefaults() {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM shortcuts').run();
      seedDefaultShortcuts(this.db);
    })();
    this.cache = null;
  }
}
