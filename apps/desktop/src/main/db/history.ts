import type Database from 'better-sqlite3';
import { domainInfo } from '../../shared/domain';
import type { DomainCount, HistoryFilter, VisitRow } from '../../shared/types';
import { buildWhere } from './history-query';

const chunk = <T>(a: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
};

export class HistoryRepo {
  constructor(private db: Database.Database) {}

  add(url: string, title: string, favicon?: string | null): number | null {
    const { hostname, domain } = domainInfo(url);
    if (!hostname) return null;
    const r = this.db
      .prepare('INSERT INTO visits(url,title,hostname,domain,favicon,visited_at) VALUES (?,?,?,?,?,?)')
      .run(url, title || '', hostname, domain, favicon ?? null, Date.now());
    return Number(r.lastInsertRowid);
  }

  updateTitle(id: number, title: string) {
    this.db.prepare('UPDATE visits SET title = ? WHERE id = ?').run(title, id);
  }
  updateFavicon(id: number, favicon: string) {
    this.db.prepare('UPDATE visits SET favicon = ? WHERE id = ?').run(favicon, id);
  }

  list(f: HistoryFilter): { items: VisitRow[]; total: number } {
    const { sql, params } = buildWhere(f);
    const limit = Math.min(Math.max(f.limit ?? 200, 1), 1000);
    const offset = Math.max(f.offset ?? 0, 0);
    const rows = this.db
      .prepare(
        `SELECT id, url, title, hostname, domain, favicon, visited_at AS visitedAt
         FROM visits ${sql} ORDER BY visited_at DESC, id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Omit<VisitRow, 'visitCount'>[];
    const total = (this.db.prepare(`SELECT COUNT(*) AS c FROM visits ${sql}`).get(...params) as { c: number }).c;

    const counts = new Map<string, number>();
    for (const part of chunk([...new Set(rows.map((r) => r.url))], 500)) {
      const q = `SELECT url, COUNT(*) AS c FROM visits WHERE url IN (${part.map(() => '?').join(',')}) GROUP BY url`;
      for (const r of this.db.prepare(q).all(...part) as { url: string; c: number }[]) counts.set(r.url, r.c);
    }
    return { items: rows.map((r) => ({ ...r, visitCount: counts.get(r.url) ?? 1 })), total };
  }

  /** Top domains for the filter chips. Ignores the domain filters so the chips don't disappear when one is selected. */
  domains(f: HistoryFilter, top = 5): { total: number; domains: DomainCount[] } {
    const { sql, params } = buildWhere({ ...f, domain: undefined, excludeDomains: undefined });
    const total = (this.db.prepare(`SELECT COUNT(*) AS c FROM visits ${sql}`).get(...params) as { c: number }).c;
    const domains = this.db
      .prepare(
        `SELECT domain, COUNT(*) AS count FROM visits ${sql}
         GROUP BY domain ORDER BY count DESC, MAX(visited_at) DESC LIMIT ?`
      )
      .all(...params, top) as DomainCount[];
    return { total, domains };
  }

  topSites(limit = 8): { domain: string; url: string; title: string; favicon: string | null; count: number }[] {
    return this.db
      .prepare(
        `SELECT domain, url, title, favicon, COUNT(*) AS count, MAX(visited_at) AS last
         FROM visits GROUP BY domain ORDER BY count DESC, last DESC LIMIT ?`
      )
      .all(limit) as never;
  }

  deleteIds(ids: number[]): number {
    let n = 0;
    this.db.transaction(() => {
      for (const part of chunk(ids, 500)) {
        n += this.db.prepare(`DELETE FROM visits WHERE id IN (${part.map(() => '?').join(',')})`).run(...part).changes;
      }
    })();
    return n;
  }
  deleteAll(): number { return this.db.prepare('DELETE FROM visits').run().changes; }
  deleteDomain(domain: string): number {
    return this.db.prepare('DELETE FROM visits WHERE domain = ?').run(domain).changes;
  }
}
