import { app, dialog, ipcMain, nativeTheme, session, type IpcMainInvokeEvent } from 'electron';
import fs from 'node:fs';
import { broadcast, ctx, isAppUrl } from './context';
import { BrowserWindowController } from './browser/window';
import { parseBookmarks, serializeBookmarks } from '../shared/bookmarks-html';
import type { HistoryFilter } from '../shared/types';

// ---- argument validators (الـ renderer مش موثوق فيه 100%، فبنتحقق من كل مدخل) ----
const str = (v: unknown, max = 4096): string => {
  if (typeof v !== 'string' || v.length > max) throw new Error('bad argument');
  return v;
};
const int = (v: unknown): number => {
  if (!Number.isInteger(v)) throw new Error('bad argument');
  return v as number;
};
const bool = (v: unknown): boolean => { if (typeof v !== 'boolean') throw new Error('bad argument'); return v; };
const ids = (v: unknown): number[] => {
  if (!Array.isArray(v) || v.length > 10000 || !v.every((x) => Number.isInteger(x))) throw new Error('bad argument');
  return v as number[];
};
const zoomAction = (v: unknown): 'in' | 'out' | 'reset' => {
  if (v !== 'in' && v !== 'out' && v !== 'reset') throw new Error('bad argument');
  return v;
};
function filter(raw: unknown): HistoryFilter {
  const r = (raw ?? {}) as Record<string, unknown>;
  const f: HistoryFilter = {};
  if (typeof r.search === 'string') f.search = r.search.slice(0, 200);
  if (typeof r.domain === 'string') f.domain = r.domain.slice(0, 255);
  if (Array.isArray(r.excludeDomains)) f.excludeDomains = r.excludeDomains.filter((d): d is string => typeof d === 'string').slice(0, 20);
  if (Number.isFinite(r.from)) f.from = r.from as number;
  if (Number.isFinite(r.to)) f.to = r.to as number;
  if (Number.isInteger(r.limit)) f.limit = r.limit as number;
  if (Number.isInteger(r.offset)) f.offset = r.offset as number;
  return f;
}

type Handler = (win: BrowserWindowController, e: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

function handle(name: string, fn: Handler) {
  ipcMain.handle(`nova:${name}`, (e, ...args) => {
    // بس صفحات التطبيق نفسها (UI + الصفحات الداخلية) تقدر تنادي الـ API. صفحات المواقع لأ.
    const frame = e.senderFrame;
    if (!ctx.privileged.has(e.sender.id) || !frame || frame.parent || !isAppUrl(frame.url)) throw new Error('Forbidden IPC sender');
    const win = ctx.windows.find((w) => w.owns(e.sender.id));
    if (!win) throw new Error('No window for sender');
    return fn(win, e, ...args);
  });
}

export function registerIpc() {
  // window / tabs
  handle('state.get', (w) => w.getState());
  handle('tab.new', (w, _e, input) => { w.createTab({ input: input === undefined ? undefined : str(input) }); });
  handle('tab.close', (w, _e, id) => w.closeTab(int(id)));
  handle('tab.activate', (w, _e, id) => w.activate(int(id)));
  handle('tab.navigate', (w, _e, id, input) => w.navigate(int(id), str(input, 2000)));
  handle('tab.back', (w, _e, id) => w.back(int(id)));
  handle('tab.forward', (w, _e, id) => w.forward(int(id)));
  handle('tab.reload', (w, _e, id) => w.reload(int(id)));
  handle('tab.stop', (w, _e, id) => w.stop(int(id)));
  handle('tab.duplicate', (w, _e, id) => w.duplicate(int(id)));
  handle('tab.pin', (w, _e, id, p) => w.pin(int(id), bool(p)));
  handle('tab.zoom', (w, _e, id, a) => w.zoomTab(int(id), zoomAction(a)));
  handle('tab.menu', (w, _e, id) => w.tabMenu(int(id)));
  handle('window.private', () => { new BrowserWindowController({ privateMode: true }); });
  handle('window.new', () => { new BrowserWindowController({ privateMode: false }); });
  handle('window.fullscreen', (w) => w.toggleFullscreen());
  handle('bookmark.toggleActive', (w) => w.toggleBookmarkActive());
  handle('page.open', (w, e, input, newTab) => {
    const text = str(input, 2000);
    const src = w.tabByWc(e.sender.id);
    if (newTab === true || !src) w.createTab({ input: text, afterId: src?.id });
    else w.navigate(src.id, text);
  });
  handle('page.openInternal', (w, _e, name) => w.openInternal(str(name) as never));

  // history
  handle('history.list', (_w, _e, f) => ctx.history.list(filter(f)));
  handle('history.domains', (_w, _e, f) => ctx.history.domains(filter(f), 5));
  handle('history.topSites', () => ctx.history.topSites(8));
  handle('history.deleteIds', (_w, _e, list) => ctx.history.deleteIds(ids(list)));
  handle('history.deleteAll', () => ctx.history.deleteAll());
  handle('history.deleteDomain', (_w, _e, d) => ctx.history.deleteDomain(str(d, 255)));

  // bookmarks
  handle('bookmarks.list', (_w, _e, q) => ctx.bookmarks.list(q === undefined ? undefined : str(q, 200)));
  handle('bookmarks.has', (_w, _e, url) => ctx.bookmarks.has(str(url, 2000)));
  handle('bookmarks.add', (_w, _e, b) => {
    const o = b as { title: unknown; url: unknown; folder?: unknown };
    ctx.bookmarks.add({ title: str(o.title, 300), url: str(o.url, 2000), folder: o.folder === undefined ? '' : str(o.folder, 120) });
  });
  handle('bookmarks.update', (_w, _e, id, b) => {
    const o = b as { title: unknown; url: unknown; folder: unknown };
    ctx.bookmarks.update(int(id), { title: str(o.title, 300), url: str(o.url, 2000), folder: str(o.folder, 120) });
  });
  handle('bookmarks.remove', (_w, _e, id) => ctx.bookmarks.remove(int(id)));
  handle('bookmarks.export', async () => {
    const r = await dialog.showSaveDialog({ defaultPath: 'nova-bookmarks.html', filters: [{ name: 'HTML', extensions: ['html'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    const items = ctx.bookmarks.list();
    fs.writeFileSync(r.filePath, serializeBookmarks(items), 'utf8');
    return { ok: true, count: items.length };
  });
  handle('bookmarks.import', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'HTML', extensions: ['html', 'htm'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    const stat = fs.statSync(r.filePaths[0]);
    if (stat.size > 20 * 1024 * 1024) throw new Error('الملف كبير جدًا');
    const items = parseBookmarks(fs.readFileSync(r.filePaths[0], 'utf8'));
    return { ok: true, found: items.length, added: ctx.bookmarks.importMany(items) };
  });

  // downloads
  handle('downloads.list', () => ctx.downloads.list());
  handle('downloads.pause', (_w, _e, id) => ctx.downloads.pause(str(id)));
  handle('downloads.resume', (_w, _e, id) => ctx.downloads.resume(str(id)));
  handle('downloads.cancel', (_w, _e, id) => ctx.downloads.cancel(str(id)));
  handle('downloads.open', (_w, _e, id) => ctx.downloads.open(str(id)));
  handle('downloads.show', (_w, _e, id) => ctx.downloads.show(str(id)));
  handle('downloads.remove', (_w, _e, id) => ctx.downloads.remove(str(id)));
  handle('downloads.clear', () => ctx.downloads.clearFinished());

  // settings & search engines
  handle('settings.get', () => ctx.settings.getAll());
  handle('settings.set', (_w, _e, key, value) => {
    const all = ctx.settings.set(str(key, 64), value);
    nativeTheme.themeSource = all.theme;
    broadcast('nova:settings', all);
    for (const w of ctx.windows) w.push();
    return all;
  });
  handle('engines.list', () => ctx.engines.list());
  handle('engines.add', (_w, _e, name, tpl) => ctx.engines.add(str(name, 40), str(tpl, 500)));
  handle('engines.remove', (_w, _e, id) => {
    const sid = str(id, 64);
    ctx.engines.remove(sid);
    if (ctx.settings.getAll().searchEngineId === sid) {
      const first = ctx.engines.list()[0];
      broadcast('nova:settings', ctx.settings.set('searchEngineId', first.id));
    }
  });

  // shortcuts
  handle('shortcuts.list', () => ctx.shortcuts.list());
  handle('shortcuts.save', (_w, _e, input, disableConflicting) => {
    const o = input as Record<string, unknown>;
    if (!Array.isArray(o.sequence) || !o.sequence.every((s) => typeof s === 'string')) throw new Error('bad argument');
    return ctx.shortcuts.save({
      id: o.id === undefined || o.id === null ? undefined : int(o.id),
      name: str(o.name, 100), url: str(o.url, 2000), sequence: o.sequence as string[],
      openIn: str(o.openIn, 10), enabled: bool(o.enabled)
    }, disableConflicting === true);
  });
  handle('shortcuts.remove', (_w, _e, id) => ctx.shortcuts.remove(int(id)));
  handle('shortcuts.toggle', (_w, _e, id, enabled) => ctx.shortcuts.toggle(int(id), bool(enabled)));
  handle('shortcuts.restoreDefaults', () => ctx.shortcuts.restoreDefaults());

  // browsing data & permissions
  handle('data.clear', async (_w, _e, opts) => {
    const o = (opts ?? {}) as { history?: boolean; cookies?: boolean; cache?: boolean };
    const ses = session.fromPartition(ctx.profilePartition);
    if (o.history === true) ctx.history.deleteAll();
    if (o.cookies === true) await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] });
    if (o.cache === true) await ses.clearCache();
  });
  handle('permissions.list', () => ctx.permissions.list());
  handle('permissions.remove', (_w, _e, origin, permission) => ctx.permissions.remove(str(origin), str(permission)));

  // profiles & app
  handle('profiles.list', () => ({ ...ctx.profiles.list(), current: ctx.profile.id }));
  handle('profiles.create', (_w, _e, name) => ctx.profiles.create(str(name, 40)));
  handle('profiles.remove', (_w, _e, id) => ctx.profiles.remove(str(id, 64)));
  handle('profiles.switch', (_w, _e, id) => {
    ctx.profiles.setActive(str(id, 64));
    app.relaunch();
    app.exit(0);
  });
  handle('app.info', () => ({
    version: app.getVersion(), electron: process.versions.electron, chromium: process.versions.chrome,
    node: process.versions.node, userData: app.getPath('userData')
  }));
}
