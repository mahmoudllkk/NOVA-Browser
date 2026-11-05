import { useEffect, useState } from 'react';
import { call, on } from '../api';
import { fmtBytes } from '../hooks';
import type { DownloadEntry } from '../../shared/types';

const STATE: Record<DownloadEntry['state'], string> = {
  progressing: 'بيحمّل...', paused: 'متوقف مؤقتًا', completed: 'تم', cancelled: 'اتلغى', interrupted: 'فشل / اتقطع'
};

export default function Downloads() {
  const [items, setItems] = useState<DownloadEntry[]>([]);
  useEffect(() => {
    document.title = 'Downloads';
    call<DownloadEntry[]>('downloads.list').then(setItems);
    return on('nova:downloads', setItems);
  }, []);
  return (
    <div className="page">
      <h1>Downloads (التحميلات)</h1>
      <div className="row"><span className="grow" /><button onClick={() => call('downloads.clear')}>مسح المنتهي</button></div>
      {items.length === 0 && <div className="empty">مفيش تحميلات.</div>}
      {items.map((d) => {
        const pct = d.total > 0 ? Math.min(100, Math.round((d.received / d.total) * 100)) : 0;
        const live = d.state === 'progressing' || d.state === 'paused';
        return (
          <div className="card" key={d.id}>
            <div className="row">
              <strong className="grow" dir="auto" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.filename}{d.isPrivate ? ' 🕶' : ''}</strong>
              <span className="muted">{STATE[d.state]}</span>
            </div>
            {live && <div className="row"><div className="bar"><i style={{ width: `${pct}%` }} /></div><span className="muted">{fmtBytes(d.received)}{d.total > 0 ? ` / ${fmtBytes(d.total)}` : ''}</span></div>}
            <div className="meta muted" dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.url}</div>
            <div className="row" style={{ marginTop: 8 }}>
              {d.state === 'progressing' && <button onClick={() => call('downloads.pause', d.id)}>إيقاف مؤقت</button>}
              {d.state === 'paused' && <button onClick={() => call('downloads.resume', d.id)}>استكمال</button>}
              {live && <button className="danger" onClick={() => call('downloads.cancel', d.id)}>إلغاء</button>}
              {d.state === 'completed' && <button className="primary" onClick={() => call('downloads.open', d.id)}>فتح</button>}
              {d.state === 'completed' && <button onClick={() => call('downloads.show', d.id)}>إظهار في الفولدر</button>}
              {!live && <button onClick={() => call('downloads.remove', d.id)}>إزالة من القائمة</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
