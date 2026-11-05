import { useEffect, useState } from 'react';
import { call } from '../api';
import { openLink } from '../hooks';

interface Site { domain: string; url: string; title: string; favicon: string | null; count: number }

export default function NewTab() {
  const [q, setQ] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  useEffect(() => { document.title = 'New Tab'; call<Site[]>('history.topSites').then(setSites).catch(() => undefined); }, []);
  return (
    <div className="hero">
      <h1>NOVA</h1>
      <input
        autoFocus dir="auto" value={q} placeholder="ابحث أو اكتب عنوان موقع" aria-label="بحث"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) void call('page.open', q, false); }}
      />
      {sites.length > 0 && (
        <div className="tiles" style={{ maxWidth: 760, margin: '32px auto 0' }}>
          {sites.map((s) => (
            <a key={s.domain} className="tile" href={s.url} onClick={(e) => openLink(e, s.url)}>
              {s.favicon ? <img src={s.favicon} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <span>🌐</span>}
              <span>{s.domain}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
