import { useEffect, useMemo, useState } from 'react';
import { call } from '../api';
import { fmtDay, fmtTime, openLink, useDebounced } from '../hooks';
import type { DomainCount, VisitRow } from '../../shared/types';

type Range = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';
type Group = 'none' | 'date' | 'site';
const FRIENDLY: Record<string, string> = { 'youtube.com': 'YouTube', 'facebook.com': 'Facebook', 'google.com': 'Google' };
const DAY = 86400000;

function rangeToMs(r: Range, from: string, to: string): { from?: number; to?: number } {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  switch (r) {
    case 'today': return { from: t0 };
    case 'yesterday': return { from: t0 - DAY, to: t0 };
    case '7d': return { from: Date.now() - 7 * DAY };
    case '30d': return { from: Date.now() - 30 * DAY };
    case 'custom': return {
      from: from ? new Date(from + 'T00:00:00').getTime() : undefined,
      to: to ? new Date(to + 'T00:00:00').getTime() + DAY : undefined
    };
    default: return {};
  }
}

function dayKey(ms: number) {
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function History() {
  const [search, setSearch] = useState('');
  const dsearch = useDebounced(search, 200);
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [group, setGroup] = useState<Group>('none');
  const [limit, setLimit] = useState(200);
  const [items, setItems] = useState<VisitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [chips, setChips] = useState<{ total: number; domains: DomainCount[] }>({ total: 0, domains: [] });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => { document.title = 'History'; }, []);

  const base = useMemo(() => ({ search: dsearch || undefined, ...rangeToMs(range, from, to) }), [dsearch, range, from, to]);

  useEffect(() => {
    let cancel = false;
    call<{ total: number; domains: DomainCount[] }>('history.domains', base).then((r) => { if (!cancel) setChips(r); });
    return () => { cancel = true; };
  }, [base, tick]);

  const topNames = useMemo(() => chips.domains.map((d) => d.domain), [chips]);

  useEffect(() => {
    let cancel = false;
    const f = { ...base, domain: domain && !other ? domain : undefined, excludeDomains: other ? topNames : undefined, limit };
    call<{ items: VisitRow[]; total: number }>('history.list', f).then((r) => {
      if (cancel) return;
      setItems(r.items); setTotal(r.total); setSelected(new Set());
    });
    return () => { cancel = true; };
  }, [base, domain, other, topNames, limit, tick]);

  const refresh = () => setTick((t) => t + 1);
  const otherCount = chips.total - chips.domains.reduce((a, d) => a + d.count, 0);
  const name = (d: string) => FRIENDLY[d] ?? d;
  const pick = (d: string | null, o = false) => { setDomain(d); setOther(o); setLimit(200); };

  const groups = useMemo(() => {
    if (group === 'none') return [{ key: '', label: '', rows: items }];
    const map = new Map<string, { label: string; rows: VisitRow[] }>();
    for (const r of items) {
      const key = group === 'date' ? String(dayKey(r.visitedAt)) : r.domain;
      const label = group === 'date' ? fmtDay(r.visitedAt) : r.domain;
      const g = map.get(key) ?? { label, rows: [] };
      g.rows.push(r);
      map.set(key, g);
    }
    return [...map.entries()].map(([key, g]) => ({ key, ...g }));
  }, [items, group]);

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="page">
      <h1>History (السجل)</h1>
      <div className="row">
        <input className="grow" dir="auto" placeholder="ابحث في العنوان أو الرابط" aria-label="بحث في السجل" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="الفترة" value={range} onChange={(e) => { setRange(e.target.value as Range); setLimit(200); }}>
          <option value="all">كل الوقت</option><option value="today">النهاردة</option><option value="yesterday">إمبارح</option>
          <option value="7d">آخر 7 أيام</option><option value="30d">آخر 30 يوم</option><option value="custom">فترة مخصصة</option>
        </select>
        {range === 'custom' && <>
          <input type="date" aria-label="من" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" aria-label="إلى" value={to} onChange={(e) => setTo(e.target.value)} />
        </>}
        <select aria-label="التجميع" value={group} onChange={(e) => setGroup(e.target.value as Group)}>
          <option value="none">زمني (Chronological)</option><option value="date">تجميع بالتاريخ</option><option value="site">تجميع بالموقع</option>
        </select>
      </div>

      <div className="chips" role="group" aria-label="فلتر بالموقع">
        <button className={`chip${domain === null && !other ? ' on' : ''}`} onClick={() => pick(null)}>All ({chips.total})</button>
        {chips.domains.map((d) => (
          <button key={d.domain} className={`chip${domain === d.domain && !other ? ' on' : ''}`} onClick={() => pick(d.domain)}>{name(d.domain)} ({d.count})</button>
        ))}
        {otherCount > 0 && <button className={`chip${other ? ' on' : ''}`} onClick={() => pick(null, true)}>Other ({otherCount})</button>}
      </div>

      <div className="row" style={{ marginBottom: 8 }}>
        <span className="muted">{total} زيارة</span>
        <span className="grow" />
        <button disabled={!selected.size} onClick={async () => { await call('history.deleteIds', [...selected]); refresh(); }}>مسح المحدد ({selected.size})</button>
        {domain && !other && (
          <button className="danger" onClick={async () => { if (confirm(`مسح كل سجل ${name(domain)}؟`)) { await call('history.deleteDomain', domain); pick(null); refresh(); } }}>مسح سجل {name(domain)}</button>
        )}
        <button className="danger" onClick={async () => { if (confirm('مسح كل السجل؟ مينفعش ترجعه تاني.')) { await call('history.deleteAll'); pick(null); refresh(); } }}>مسح الكل</button>
      </div>

      {items.length === 0 && <div className="empty">مفيش سجل مطابق.</div>}
      {groups.map((g) => (
        <div key={g.key}>
          {g.label && <div className="group-h">{g.label} <span className="muted">({g.rows.length})</span></div>}
          {g.rows.map((r) => (
            <div className="list-item" key={r.id}>
              <input type="checkbox" aria-label="تحديد" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              {r.favicon ? <img className="fav" src={r.favicon} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <span className="fav">🌐</span>}
              <span className="meta">{fmtTime(r.visitedAt)}</span>
              <div className="grow">
                <div className="ttl"><a href={r.url} onClick={(e) => openLink(e, r.url)}>{r.title || r.url}</a></div>
                <div className="meta" dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.hostname}{r.visitCount > 1 ? ` · ${r.visitCount} visits` : ''}</div>
              </div>
              <button aria-label="مسح" onClick={async () => { await call('history.deleteIds', [r.id]); refresh(); }}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length < total && <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}><button onClick={() => setLimit((l) => l + 200)}>عرض المزيد</button></div>}
    </div>
  );
}
