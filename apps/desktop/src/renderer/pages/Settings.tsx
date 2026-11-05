import { useEffect, useState } from 'react';
import { call, errMsg, on } from '../api';
import { DEFAULT_SETTINGS, type PermissionRow, type ProfileInfo, type SearchEngine, type Settings as S } from '../../shared/types';

interface Info { version: string; electron: string; chromium: string; node: string; userData: string }
interface Profiles { profiles: ProfileInfo[]; active: string; current: string }

export default function Settings() {
  const [s, setS] = useState<S>(DEFAULT_SETTINGS);
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [profiles, setProfiles] = useState<Profiles | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [eng, setEng] = useState({ name: '', tpl: '' });
  const [pname, setPname] = useState('');
  const [home, setHome] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [clear, setClear] = useState({ history: false, cookies: false, cache: false });

  const loadAll = () => {
    call<SearchEngine[]>('engines.list').then(setEngines);
    call<PermissionRow[]>('permissions.list').then(setPerms);
    call<Profiles>('profiles.list').then(setProfiles);
  };
  useEffect(() => {
    document.title = 'Settings';
    call<S>('settings.get').then((x) => { setS(x); setHome(x.homepage); });
    call<Info>('app.info').then(setInfo);
    loadAll();
    return on('nova:settings', setS);
  }, []);

  const guard = async (fn: () => Promise<unknown>, ok = '') => {
    setErr(''); setMsg('');
    try { await fn(); if (ok) setMsg(ok); } catch (e) { setErr(errMsg(e)); }
  };
  const set = (k: keyof S, v: unknown) => guard(() => call('settings.set', k, v));

  return (
    <div className="page">
      <h1>Settings (الإعدادات)</h1>
      {msg && <p className="okmsg" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}

      <h2>المظهر</h2>
      <div className="card row">
        <label>Theme:</label>
        <select value={s.theme} onChange={(e) => set('theme', e.target.value)}>
          <option value="system">حسب النظام</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </div>

      <h2>البداية والبحث</h2>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <label>الصفحة الرئيسية:</label>
          <input className="grow" dir="ltr" placeholder="فاضي = New Tab" value={home} onChange={(e) => setHome(e.target.value)} />
          <button onClick={() => guard(async () => { const r = await call<S>('settings.set', 'homepage', home); setHome(r.homepage); }, 'اتحفظت')}>حفظ</button>
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>محرك البحث الافتراضي:</label>
          <select value={s.searchEngineId} onChange={(e) => set('searchEngineId', e.target.value)}>
            {engines.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        {engines.map((e) => (
          <div className="list-item" key={e.id}>
            <strong>{e.name}</strong><span className="meta grow" dir="ltr">{e.urlTemplate}</span>
            <button className="danger" onClick={() => guard(async () => { await call('engines.remove', e.id); loadAll(); })}>حذف</button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <input placeholder="اسم المحرك" value={eng.name} onChange={(e) => setEng({ ...eng, name: e.target.value })} />
          <input className="grow" dir="ltr" placeholder="https://example.com/search?q=%s" value={eng.tpl} onChange={(e) => setEng({ ...eng, tpl: e.target.value })} />
          <button onClick={() => guard(async () => { await call('engines.add', eng.name, eng.tpl); setEng({ name: '', tpl: '' }); loadAll(); }, 'اتضاف')}>إضافة</button>
        </div>
      </div>

      <h2>الاختصارات</h2>
      <div className="card row">
        <label>أقصى وقت بين خطوات الاختصار (ms):</label>
        <input type="number" min={300} max={5000} step={100} value={s.shortcutTimeoutMs} style={{ width: 100 }}
          onChange={(e) => set('shortcutTimeoutMs', Number(e.target.value))} />
        <button onClick={() => call('page.openInternal', 'shortcuts')}>إدارة الاختصارات</button>
      </div>

      <h2>Profiles</h2>
      <div className="card">
        {profiles?.profiles.map((p) => (
          <div className="list-item" key={p.id}>
            <strong className="grow">{p.name}{p.id === profiles.current ? ' (الحالي)' : ''}</strong>
            {p.id !== profiles.current && <button onClick={() => guard(async () => { if (confirm(`التبديل لـ ${p.name} هيعمل restart للمتصفح. تكمل؟`)) await call('profiles.switch', p.id); })}>تبديل</button>}
            {p.id !== profiles.current && <button className="danger" onClick={() => guard(async () => { if (confirm(`حذف ${p.name} وكل بياناته؟`)) { await call('profiles.remove', p.id); loadAll(); } })}>حذف</button>}
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <input placeholder="اسم Profile جديد" value={pname} onChange={(e) => setPname(e.target.value)} />
          <button onClick={() => guard(async () => { await call('profiles.create', pname); setPname(''); loadAll(); }, 'اتعمل Profile جديد')}>إنشاء</button>
        </div>
        <p className="muted">كل Profile ليه history وbookmarks واختصارات وكوكيز مستقلة.</p>
      </div>

      <h2>بيانات التصفح</h2>
      <div className="card">
        <div className="row">
          {(['history', 'cookies', 'cache'] as const).map((k) => (
            <label key={k}><input type="checkbox" checked={clear[k]} onChange={(e) => setClear({ ...clear, [k]: e.target.checked })} /> {k === 'history' ? 'History' : k === 'cookies' ? 'Cookies وبيانات المواقع' : 'Cache'}</label>
          ))}
          <button className="danger" disabled={!clear.history && !clear.cookies && !clear.cache}
            onClick={() => guard(async () => { if (confirm('مسح البيانات المحددة؟')) await call('data.clear', clear); }, 'تم المسح')}>مسح</button>
        </div>
      </div>

      <h2>صلاحيات المواقع</h2>
      <div className="card">
        {perms.length === 0 && <span className="muted">مفيش قرارات محفوظة.</span>}
        {perms.map((p) => (
          <div className="list-item" key={p.origin + p.permission}>
            <span className="grow" dir="ltr">{p.origin} — {p.permission}</span>
            <span className={p.decision === 'allow' ? 'okmsg' : 'error'}>{p.decision === 'allow' ? 'مسموح' : 'محظور'}</span>
            <button onClick={() => guard(async () => { await call('permissions.remove', p.origin, p.permission); loadAll(); })}>إزالة</button>
          </div>
        ))}
      </div>

      <h2>عن NOVA</h2>
      <div className="card muted" dir="ltr">
        {info ? `NOVA ${info.version} · Electron ${info.electron} · Chromium ${info.chromium} · Node ${info.node}` : '...'}
        <br />{info?.userData}
      </div>
    </div>
  );
}
