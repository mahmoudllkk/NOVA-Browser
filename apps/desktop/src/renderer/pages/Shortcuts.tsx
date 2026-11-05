import { useEffect, useState } from 'react';
import { call, errMsg } from '../api';
import { normalizeCombo } from '../../shared/keys';
import type { Settings, ShortcutRow, ShortcutSaveResult } from '../../shared/types';

interface Form { id?: number; name: string; url: string; sequence: string[]; openIn: 'new' | 'current'; enabled: boolean }
const EMPTY: Form = { name: '', url: '', sequence: [], openIn: 'new', enabled: true };

const Seq = ({ seq }: { seq: string[] }) => (
  <span dir="ltr">{seq.map((s, i) => <span key={i}><span className="kbd">{s}</span>{i < seq.length - 1 ? '← ' : ''}</span>)}</span>
);

export default function Shortcuts() {
  const [rows, setRows] = useState<ShortcutRow[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<{ id: number; name: string }[]>([]);
  const [timeout, setTimeoutMs] = useState(1500);
  const [fatal, setFatal] = useState('');

  const load = () => call<ShortcutRow[]>('shortcuts.list').then(setRows);
  useEffect(() => {
    document.title = 'Shortcuts';
    void load();
    call<Settings>('settings.get').then((s) => setTimeoutMs(s.shortcutTimeoutMs));
  }, []);

  const save = async (disableConflicting = false) => {
    if (!form) return;
    setErrors([]); setConflicts([]);
    try {
      const r = await call<ShortcutSaveResult>('shortcuts.save', form, disableConflicting);
      if (r.ok) { setForm(null); await load(); } else { setErrors(r.errors); setConflicts(r.conflicts); }
    } catch (e) { setFatal(errMsg(e)); }
  };

  const capture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (!form || e.repeat) return;
    const combo = normalizeCombo({ key: e.key, control: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });
    if (combo && form.sequence.length < 4) setForm({ ...form, sequence: [...form.sequence, combo] });
  };

  return (
    <div className="page">
      <h1>Keyboard Shortcuts (اختصاراتي)</h1>
      <p className="muted">مثال: <span className="kbd">Ctrl+Y</span> وبعدها <span className="kbd">Y</span> يفتح YouTube. الخطوة الأولى لازم فيها Ctrl أو Alt. الاختصارات خاصة بالـ Profile الحالي.</p>
      {fatal && <p className="error">{fatal}</p>}

      <div className="row" style={{ margin: '12px 0' }}>
        <button className="primary" onClick={() => { setForm({ ...EMPTY }); setErrors([]); setConflicts([]); }}>＋ اختصار جديد</button>
        <label>الوقت بين الخطوات (ms):</label>
        <input type="number" min={300} max={5000} step={100} style={{ width: 90 }} value={timeout}
          onChange={(e) => { const v = Number(e.target.value); setTimeoutMs(v); call('settings.set', 'shortcutTimeoutMs', v).catch(() => undefined); }} />
        <span className="grow" />
        <button className="danger" onClick={async () => { if (confirm('إرجاع الاختصارات الافتراضية؟ اللي عملته هيتمسح.')) { await call('shortcuts.restoreDefaults'); await load(); } }}>Restore defaults</button>
      </div>

      {form && (
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <input dir="auto" placeholder="الاسم" aria-label="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="grow" dir="ltr" placeholder="youtube.com" aria-label="الرابط" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <select aria-label="يفتح في" value={form.openIn} onChange={(e) => setForm({ ...form, openIn: e.target.value as 'new' | 'current' })}>
              <option value="new">تبويب جديد</option><option value="current">التبويب الحالي</option>
            </select>
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <input readOnly aria-label="سجّل اختصار" placeholder="اضغط هنا وبعدين اضغط الاختصار (كل ضغطة = خطوة)" className="grow" onKeyDown={capture} />
            <Seq seq={form.sequence} />
            <button onClick={() => setForm({ ...form, sequence: form.sequence.slice(0, -1) })} disabled={!form.sequence.length}>⌫ خطوة</button>
          </div>
          {errors.map((m, i) => <div className="error" key={i}>{m}</div>)}
          {conflicts.length > 0 && (
            <div className="row">
              <span className="error">تعارض مع: {conflicts.map((c) => c.name).join('، ')}</span>
              <button onClick={() => save(true)}>عطّلهم واحفظ</button>
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" onClick={() => save()}>حفظ</button>
            <button onClick={() => setForm(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? <div className="empty">مفيش اختصارات.</div> : (
        <table>
          <thead><tr><th>مفعّل</th><th>الاسم</th><th>الاختصار</th><th>الرابط</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" aria-label="تفعيل" checked={r.enabled} onChange={async (e) => {
                  const res = await call<ShortcutSaveResult>('shortcuts.toggle', r.id, e.target.checked);
                  if (!res.ok) setFatal(res.errors.join(' — ') + (res.conflicts.length ? ': ' + res.conflicts.map((c) => c.name).join('، ') : ''));
                  else setFatal('');
                  await load();
                }} /></td>
                <td>{r.name}</td>
                <td><Seq seq={r.sequence} /></td>
                <td dir="ltr" className="muted">{r.url}</td>
                <td>
                  <button onClick={() => { setForm({ ...r }); setErrors([]); setConflicts([]); }}>تعديل</button>{' '}
                  <button className="danger" aria-label="حذف" onClick={async () => { await call('shortcuts.remove', r.id); await load(); }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
