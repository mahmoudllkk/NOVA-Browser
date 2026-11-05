import { useEffect, useMemo, useState } from 'react';
import { call, errMsg } from '../api';
import { openLink, useDebounced } from '../hooks';
import type { Bookmark } from '../../shared/types';

export default function Bookmarks() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 150);
  const [items, setItems] = useState<Bookmark[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [form, setForm] = useState<{ id?: number; title: string; url: string; folder: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => call<Bookmark[]>('bookmarks.list', dq || undefined).then(setItems);
  useEffect(() => { document.title = 'Bookmarks'; }, []);
  useEffect(() => { void load(); }, [dq]);

  const folders = useMemo(() => [...new Set(items.map((b) => b.folder).filter(Boolean))].sort(), [items]);
  const shown = folder === null ? items : items.filter((b) => b.folder === folder);

  const save = async () => {
    if (!form) return;
    setErr('');
    try {
      if (form.id) await call('bookmarks.update', form.id, form); else await call('bookmarks.add', form);
      setForm(null); await load();
    } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <div className="page">
      <h1>Bookmarks (المفضلة)</h1>
      <div className="row">
        <input className="grow" dir="auto" placeholder="ابحث في المفضلة" aria-label="بحث" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => setForm({ title: '', url: '', folder: '' })}>＋ إضافة</button>
        <button onClick={async () => { setErr(''); try { const r = await call<{ ok: boolean; found?: number; added?: number }>('bookmarks.import'); if (r.ok) { setMsg(`اتضاف ${r.added} من ${r.found}`); await load(); } } catch (e) { setErr(errMsg(e)); } }}>Import</button>
        <button onClick={async () => { const r = await call<{ ok: boolean; count?: number }>('bookmarks.export'); if (r.ok) setMsg(`اتصدّر ${r.count} bookmark`); }}>Export</button>
      </div>
      {msg && <p className="okmsg">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {form && (
        <div className="card">
          <div className="row">
            <input dir="auto" placeholder="العنوان" aria-label="العنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="grow" dir="ltr" placeholder="https://..." aria-label="الرابط" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <input dir="auto" placeholder="Folder (اختياري)" aria-label="فولدر" value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} />
            <button className="primary" onClick={save}>حفظ</button>
            <button onClick={() => { setForm(null); setErr(''); }}>إلغاء</button>
          </div>
        </div>
      )}
      {folders.length > 0 && (
        <div className="chips">
          <button className={`chip${folder === null ? ' on' : ''}`} onClick={() => setFolder(null)}>الكل</button>
          {folders.map((f) => <button key={f} className={`chip${folder === f ? ' on' : ''}`} onClick={() => setFolder(f)}>{f}</button>)}
        </div>
      )}
      {shown.length === 0 && <div className="empty">مفيش Bookmarks لسه. اضغط ☆ في شريط العنوان أو Ctrl+D وانت في أي موقع.</div>}
      {shown.map((b) => (
        <div className="list-item" key={b.id}>
          {b.favicon ? <img className="fav" src={b.favicon} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <span className="fav">🌐</span>}
          <div className="grow">
            <div className="ttl"><a href={b.url} onClick={(e) => openLink(e, b.url)}>{b.title}</a></div>
            <div className="meta" dir="ltr">{b.url}{b.folder ? `  ·  ${b.folder}` : ''}</div>
          </div>
          <button onClick={() => setForm({ id: b.id, title: b.title, url: b.url, folder: b.folder })}>تعديل</button>
          <button className="danger" aria-label="حذف" onClick={async () => { await call('bookmarks.remove', b.id); await load(); }}>✕</button>
        </div>
      ))}
    </div>
  );
}
