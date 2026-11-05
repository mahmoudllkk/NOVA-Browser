import type { HistoryFilter } from '../../shared/types';

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);

/** Builds the WHERE clause for history queries. Pure, so it is unit-tested without a database. */
export function buildWhere(f: HistoryFilter): { sql: string; params: unknown[] } {
  const c: string[] = [];
  const p: unknown[] = [];
  if (f.search && f.search.trim()) {
    const like = `%${escapeLike(f.search.trim())}%`;
    c.push("(title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\')");
    p.push(like, like);
  }
  if (f.domain) { c.push('domain = ?'); p.push(f.domain); }
  if (f.excludeDomains && f.excludeDomains.length) {
    c.push(`domain NOT IN (${f.excludeDomains.map(() => '?').join(',')})`);
    p.push(...f.excludeDomains);
  }
  if (typeof f.from === 'number') { c.push('visited_at >= ?'); p.push(f.from); }
  if (typeof f.to === 'number') { c.push('visited_at < ?'); p.push(f.to); }
  return { sql: c.length ? 'WHERE ' + c.join(' AND ') : '', params: p };
}
