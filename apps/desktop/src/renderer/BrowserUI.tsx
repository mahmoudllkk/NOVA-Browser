import { useEffect, useRef, useState } from 'react';
import { call, on } from './api';
import type { TabInfo, WindowState } from '../shared/types';

const ERRORS: Record<number, string> = {
  [-105]: 'مش قادر يلاقي عنوان الموقع. اتأكد إنك كاتب العنوان صح.',
  [-106]: 'مفيش اتصال بالإنترنت.',
  [-102]: 'الموقع رفض الاتصال.',
  [-118]: 'الموقع أخد وقت طويل ومردش.',
  [-7]: 'انتهت مهلة الاتصال.',
  [-1]: 'التبويب وقع (crashed). جرّب إعادة التحميل.'
};
const errorText = (code: number) =>
  ERRORS[code] ?? (code <= -200 && code > -300 ? 'فيه مشكلة في شهادة الأمان (SSL certificate) للموقع ده، فمتصفحتش الصفحة عشان حمايتك.' : 'حصلت مشكلة في تحميل الصفحة.');

function TabButton({ t }: { t: TabInfo }) {
  return (
    <div
      role="tab" aria-selected={t.active} tabIndex={0} title={t.title}
      className={`tab${t.active ? ' active' : ''}${t.pinned ? ' pinned' : ''}`}
      onClick={() => call('tab.activate', t.id)}
      onAuxClick={(e) => { if (e.button === 1) void call('tab.close', t.id); }}
      onContextMenu={(e) => { e.preventDefault(); void call('tab.menu', t.id); }}
      onKeyDown={(e) => { if (e.key === 'Enter') void call('tab.activate', t.id); }}
    >
      {t.loading ? <span className="spinner" /> : t.favicon ? <img className="fav" src={t.favicon} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <span className="fav">🌐</span>}
      {!t.pinned && <span className="title">{t.title}</span>}
      {!t.pinned && <button className="x" aria-label={`إغلاق ${t.title}`} onClick={(e) => { e.stopPropagation(); void call('tab.close', t.id); }}>✕</button>}
    </div>
  );
}

export default function BrowserUI() {
  const [state, setState] = useState<WindowState | null>(null);
  const [addr, setAddr] = useState('');
  const [editing, setEditing] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    call<WindowState>('state.get').then(setState).catch(() => undefined);
    const off1 = on('nova:state', setState);
    const off2 = on('nova:focus-address', () => { input.current?.focus(); input.current?.select(); });
    return () => { off1(); off2(); };
  }, []);

  const active = state?.tabs.find((t) => t.active);
  useEffect(() => { if (!editing) setAddr(active?.url ?? ''); }, [active?.url, active?.id, editing]);
  useEffect(() => {
    if (active && /^https?:/.test(active.url)) call<boolean>('bookmarks.has', active.url).then(setBookmarked).catch(() => undefined);
    else setBookmarked(false);
  }, [active?.url, state]);

  if (!state) return null;
  const id = active?.id ?? -1;

  return (
    <div className="ui">
      <div className="tabstrip" role="tablist">
        {state.tabs.map((t) => <TabButton key={t.id} t={t} />)}
        <button className="newtab-btn" aria-label="تبويب جديد" title="تبويب جديد (Ctrl+T)" onClick={() => call('tab.new')}>＋</button>
        {state.privateMode && <span className="badge">🕶 Private</span>}
      </div>
      <div className="toolbar">
        <button className="ib" aria-label="رجوع" title="رجوع (Alt+←)" disabled={!active?.canGoBack} onClick={() => call('tab.back', id)}>←</button>
        <button className="ib" aria-label="تقدم" title="تقدم (Alt+→)" disabled={!active?.canGoForward} onClick={() => call('tab.forward', id)}>→</button>
        <button className="ib" aria-label={active?.loading ? 'إيقاف' : 'إعادة تحميل'} title={active?.loading ? 'إيقاف' : 'إعادة تحميل (Ctrl+R)'}
          onClick={() => call(active?.loading ? 'tab.stop' : 'tab.reload', id)}>{active?.loading ? '✕' : '⟳'}</button>
        <input
          ref={input} className="address" dir="ltr" spellCheck={false} aria-label="شريط العنوان"
          placeholder="ابحث أو اكتب عنوان موقع" value={addr}
          onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
          onBlur={() => setEditing(false)}
          onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { void call('tab.navigate', id, addr); e.currentTarget.blur(); }
            if (e.key === 'Escape') { setAddr(active?.url ?? ''); e.currentTarget.blur(); }
          }}
        />
        {active && active.zoomPercent !== 100 && (
          <button className="zoombadge" title="اضغط لإرجاع الزوم 100%" onClick={() => call('tab.zoom', id, 'reset')}>{active.zoomPercent}%</button>
        )}
        <button className="ib" aria-label="حفظ في المفضلة" title="Bookmark (Ctrl+D)" disabled={!active || !/^https?:/.test(active.url)}
          onClick={() => call('bookmark.toggleActive')}>{bookmarked ? '★' : '☆'}</button>
        <button className="ib" aria-label="السجل" title="History (Ctrl+H)" onClick={() => call('page.openInternal', 'history')}>🕘</button>
        <button className="ib" aria-label="المفضلة" title="Bookmarks (Ctrl+Shift+O)" onClick={() => call('page.openInternal', 'bookmarks')}>📑</button>
        <button className="ib" aria-label="التحميلات" title="Downloads (Ctrl+J)" onClick={() => call('page.openInternal', 'downloads')}>⬇</button>
        <button className="ib" aria-label="الاختصارات" title="Shortcuts" onClick={() => call('page.openInternal', 'shortcuts')}>⌨</button>
        <button className="ib" aria-label="نافذة خاصة" title="Private window (Ctrl+Shift+N)" onClick={() => call('window.private')}>🕶</button>
        <button className="ib" aria-label="الإعدادات" title="Settings" onClick={() => call('page.openInternal', 'settings')}>⚙</button>
      </div>
      <div className={`progress${active?.loading ? ' on' : ''}`} role="progressbar" aria-busy={!!active?.loading} />
      {active?.error && (
        <div className="errorpage" role="alert">
          <div>
            <h1>الصفحة مش متاحة</h1>
            <p>{errorText(active.error.code)}</p>
            <p className="muted" dir="ltr"><code>{active.error.url}</code><br />Error {active.error.code}: {active.error.description}</p>
            <button className="primary" onClick={() => call('tab.reload', id)}>جرّب تاني</button>
          </div>
        </div>
      )}
    </div>
  );
}
