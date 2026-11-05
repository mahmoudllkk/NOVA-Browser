import { BaseWindow, WebContentsView, Menu, clipboard, shell, session, type MenuItemConstructorOptions, type Session, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { ctx, isAppUrl } from '../context';
import { configureSession } from './session';
import { normalizeCombo } from '../../shared/keys';
import { SequenceMatcher, hasModifiers, stripModifiers } from '../../shared/shortcut-engine';
import { resolveInput, type Target } from '../../shared/url';
import type { InternalPage, ShortcutRow, TabInfo, WindowState } from '../../shared/types';

const TAB_STRIP = 38, TOOLBAR = 46, PROGRESS = 2;
export const CHROME_HEIGHT = TAB_STRIP + TOOLBAR + PROGRESS;
const ZOOM_PRESETS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];

interface Tab {
  id: number;
  view: WebContentsView;
  kind: 'web' | 'internal';
  internalName: InternalPage | null;
  pinned: boolean;
  title: string;
  url: string;
  favicon?: string;
  loading: boolean;
  error: TabInfo['error'];
  lastVisitId: number | null;
  lastUrl: string;
  popupTimes: number[];
}

export class BrowserWindowController {
  readonly win: BaseWindow;
  readonly privateMode: boolean;
  private ui: WebContentsView;
  private ses: Session;
  private partition: string;
  private tabs: Tab[] = [];
  private byWc = new Map<number, Tab>();
  private activeId: number | null = null;
  private nextTabId = 1;
  private closedUrls: string[] = [];
  private pushQueued = false;
  private matcher: SequenceMatcher;

  constructor(opts: { privateMode: boolean }) {
    this.privateMode = opts.privateMode;
    this.partition = opts.privateMode ? `private-${randomUUID()}` : ctx.profilePartition;
    this.ses = session.fromPartition(this.partition);
    configureSession(this.ses, { isPrivate: opts.privateMode });
    this.matcher = new SequenceMatcher(() => ctx.shortcuts.list(), () => ctx.settings.getAll().shortcutTimeoutMs);

    this.win = new BaseWindow({
      width: 1280, height: 800, minWidth: 640, minHeight: 420,
      title: opts.privateMode ? 'NOVA (Private)' : 'NOVA Browser',
      backgroundColor: opts.privateMode ? '#1f1f28' : '#202124'
    });

    // الـ UI (التابات + شريط العنوان) هو WebContentsView لوحده تحت كل تابات المواقع.
    this.ui = new WebContentsView({
      webPreferences: { preload: ctx.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    this.win.contentView.addChildView(this.ui);
    ctx.privileged.add(this.ui.webContents.id);
    this.ui.webContents.on('before-input-event', (e, input) => this.handleInput(e, input, this.ui.webContents));
    void this.ui.webContents.loadURL(`${ctx.appPage}#/ui`);

    const relayout = () => { this.layout(); this.push(); };
    this.win.on('resize', relayout);
this.win.on('maximize', relayout);
this.win.on('unmaximize', relayout);
this.win.on('enter-full-screen', relayout);
this.win.on('leave-full-screen', relayout);
    this.win.on('closed', () => this.onClosed());

    ctx.windows.push(this);
    const home = ctx.settings.getAll().homepage;
    this.createTab({ input: home || undefined });
    this.layout();
  }

  // ---------- lookup ----------
  owns(wcId: number): boolean { return wcId === this.ui.webContents.id || this.byWc.has(wcId); }
  tabByWc(wcId: number): Tab | undefined { return this.byWc.get(wcId); }
  private tab(id: number): Tab | undefined { return this.tabs.find((t) => t.id === id); }
  private get active(): Tab | undefined { return this.activeId === null ? undefined : this.tab(this.activeId); }
  focus() { if (this.win.isMinimized()) this.win.restore(); this.win.focus(); }

  // ---------- tabs ----------
  private makeView(kind: 'web' | 'internal'): WebContentsView {
    return new WebContentsView({
      webPreferences: {
        partition: this.partition,
        preload: kind === 'internal' ? ctx.preloadPath : undefined,
        contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true
      }
    });
  }

  private template(): string { return ctx.engines.get(ctx.settings.getAll().searchEngineId)?.urlTemplate ?? 'https://www.google.com/search?q=%s'; }

  createTab(opts: { input?: string; activate?: boolean; afterId?: number } = {}): Tab {
    const target: Target = (opts.input ? resolveInput(opts.input, this.template()) : null) ?? { type: 'internal', name: 'newtab' };
    const kind = target.type === 'internal' ? 'internal' : 'web';
    const tab: Tab = {
      id: this.nextTabId++, view: this.makeView(kind), kind, internalName: null, pinned: false,
      title: '', url: '', loading: false, error: null, lastVisitId: null, lastUrl: '', popupTimes: []
    };
    const afterIdx = opts.afterId ? this.tabs.findIndex((t) => t.id === opts.afterId) : -1;
    if (afterIdx >= 0) this.tabs.splice(afterIdx + 1, 0, tab); else this.tabs.push(tab);
    this.win.contentView.addChildView(tab.view);
    this.bind(tab);
    this.loadTarget(tab, target);
    if (opts.activate ?? true) this.activate(tab.id); else { this.layout(); this.push(); }
    return tab;
  }

  private loadTarget(tab: Tab, target: Target) {
    const wc = tab.view.webContents;
    if (target.type === 'internal') {
      tab.internalName = target.name;
      tab.url = `nova://${target.name}`;
      void wc.loadURL(`${ctx.appPage}#/${target.name}`);
    } else {
      tab.internalName = null;
      tab.url = target.url;
      wc.loadURL(target.url).catch(() => { /* failures are reported by did-fail-load */ });
    }
  }

  activate(id: number) {
    if (!this.tab(id)) return;
    this.activeId = id;
    this.layout();
    this.active?.view.webContents.focus();
    this.push();
  }

  closeTab(id: number) {
    const i = this.tabs.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [tab] = this.tabs.splice(i, 1);
    if (!this.privateMode && tab.kind === 'web' && /^https?:/.test(tab.url)) this.closedUrls.push(tab.url);
    this.destroyView(tab);
    if (!this.tabs.length) { this.win.close(); return; }
    if (this.activeId === id) this.activeId = (this.tabs[i] ?? this.tabs[i - 1]).id;
    this.layout();
    this.active?.view.webContents.focus();
    this.push();
  }

  private destroyView(tab: Tab) {
    const wc = tab.view.webContents;
    this.byWc.delete(wc.id);
    ctx.privileged.delete(wc.id);
    if (!this.win.isDestroyed()) this.win.contentView.removeChildView(tab.view);
    if (!wc.isDestroyed()) wc.close();
  }

  /** Internal pages and web pages need different webPreferences, so switching kind swaps the view. */
  private swapView(tab: Tab, kind: 'web' | 'internal') {
    this.destroyView(tab);
    tab.kind = kind;
    tab.view = this.makeView(kind);
    tab.error = null;
    tab.loading = false;
    tab.lastVisitId = null;
    this.win.contentView.addChildView(tab.view);
    this.bind(tab);
  }

  navigate(id: number, input: string) {
    const tab = this.tab(id);
    if (!tab) return;
    const target = resolveInput(input, this.template());
    if (!target) return;
    const kind = target.type === 'internal' ? 'internal' : 'web';
    if (kind !== tab.kind) this.swapView(tab, kind);
    tab.error = null;
    this.loadTarget(tab, target);
    this.layout();
    tab.view.webContents.focus();
    this.push();
  }

  back(id: number) { const w = this.tab(id)?.view.webContents; if (w?.navigationHistory.canGoBack()) w.navigationHistory.goBack(); }
  forward(id: number) { const w = this.tab(id)?.view.webContents; if (w?.navigationHistory.canGoForward()) w.navigationHistory.goForward(); }
  stop(id: number) { this.tab(id)?.view.webContents.stop(); }
  reload(id: number, hard = false) {
    const tab = this.tab(id);
    if (!tab) return;
    if (tab.error) { this.navigate(id, tab.error.url); return; }
    if (hard) tab.view.webContents.reloadIgnoringCache(); else tab.view.webContents.reload();
  }
  duplicate(id: number) { const t = this.tab(id); if (t) this.createTab({ input: t.url, afterId: id }); }
  pin(id: number, pinned: boolean) {
    const i = this.tabs.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [tab] = this.tabs.splice(i, 1);
    tab.pinned = pinned;
    const pinnedCount = this.tabs.filter((t) => t.pinned).length;
    this.tabs.splice(pinned ? pinnedCount : pinnedCount, 0, tab);
    this.push();
  }
  closeOthers(id: number) { for (const t of [...this.tabs]) if (t.id !== id && !t.pinned) this.closeTab(t.id); }
  reopenClosed() { const u = this.closedUrls.pop(); if (u) this.createTab({ input: u }); }
  cycle(delta: number) {
    if (!this.tabs.length) return;
    const i = this.tabs.findIndex((t) => t.id === this.activeId);
    this.activate(this.tabs[(i + delta + this.tabs.length) % this.tabs.length].id);
  }

  zoom(tab: Tab, action: 'in' | 'out' | 'reset') {
    const wc = tab.view.webContents;
    const cur = Math.round(Math.pow(1.2, wc.getZoomLevel()) * 100);
    let next = 100;
    if (action === 'in') next = ZOOM_PRESETS.find((p) => p > cur) ?? 500;
    if (action === 'out') next = [...ZOOM_PRESETS].reverse().find((p) => p < cur) ?? 25;
    wc.setZoomLevel(Math.log(next / 100) / Math.log(1.2));
    this.push();
  }
  zoomActive(action: 'in' | 'out' | 'reset') { const t = this.active; if (t) this.zoom(t, action); }
  zoomTab(id: number, action: 'in' | 'out' | 'reset') { const t = this.tab(id); if (t) this.zoom(t, action); }

  toggleFullscreen() { this.win.setFullScreen(!this.win.isFullScreen()); }

  toggleBookmarkActive() {
    const t = this.active;
    if (!t || t.kind !== 'web' || !/^https?:/.test(t.url)) return;
    if (ctx.bookmarks.has(t.url)) ctx.bookmarks.removeByUrl(t.url);
    else ctx.bookmarks.add({ title: t.title || t.url, url: t.url, favicon: t.favicon });
    this.push();
  }

  // ---------- events ----------
  private bind(tab: Tab) {
    const wc = tab.view.webContents;
    this.byWc.set(wc.id, tab);
    if (tab.kind === 'internal') ctx.privileged.add(wc.id);

    wc.on('page-title-updated', (_e, title) => {
      tab.title = title;
      if (tab.lastVisitId) ctx.history.updateTitle(tab.lastVisitId, title);
      this.push();
    });
    wc.on('page-favicon-updated', (_e, favs) => {
      tab.favicon = favs[0];
      if (tab.lastVisitId && favs[0]) ctx.history.updateFavicon(tab.lastVisitId, favs[0]);
      this.push();
    });
    wc.on('did-start-loading', () => { tab.loading = true; tab.error = null; this.layout(); this.push(); });
    wc.on('did-stop-loading', () => { tab.loading = false; this.push(); });
    wc.on('did-navigate', (_e, url) => this.onNavigated(tab, url, false));
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) this.onNavigated(tab, url, true); });
    wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === -3) return; // -3 = aborted by a new navigation
      tab.error = { code, description, url };
      tab.url = url;
      this.layout();
      this.push();
    });
    wc.on('render-process-gone', () => {
      tab.error = { code: -1, description: 'CRASHED', url: tab.url };
      this.layout();
      this.push();
    });
    wc.on('zoom-changed', (_e, dir) => this.zoom(tab, dir));
    wc.on('before-input-event', (e, input) => this.handleInput(e, input, wc));
    wc.on('enter-html-full-screen', () => this.win.setFullScreen(true));
    wc.on('leave-html-full-screen', () => this.win.setFullScreen(false));

    wc.on('will-navigate', (e, url) => {
      if (tab.kind === 'internal' ? !isAppUrl(url) : !/^https?:/i.test(url)) {
        e.preventDefault();
        if (/^https?:/i.test(url)) this.createTab({ input: url, afterId: tab.id });
        else if (/^(mailto|tel):/i.test(url)) void shell.openExternal(url);
      }
    });

    // Popups: كل window.open بيتحول لتاب جديد. وبنحدد عدد الـ popups عشان نمنع الإزعاج.
    wc.setWindowOpenHandler(({ url }) => {
      const now = Date.now();
      tab.popupTimes = tab.popupTimes.filter((t) => now - t < 2000);
      if (tab.popupTimes.length >= 3) return { action: 'deny' };
      tab.popupTimes.push(now);
      if (/^https?:/i.test(url)) this.createTab({ input: url, afterId: tab.id });
      else if (/^(mailto|tel):/i.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });

    wc.on('context-menu', (_e, p) => {
      const items: MenuItemConstructorOptions[] = [];
      if (/^https?:/i.test(p.linkURL)) {
        items.push(
          { label: 'فتح الرابط في تبويب جديد', click: () => this.createTab({ input: p.linkURL, afterId: tab.id, activate: false }) },
          { label: 'نسخ الرابط', click: () => clipboard.writeText(p.linkURL) }, { type: 'separator' });
      }
      if (p.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
      else if (p.selectionText) items.push({ role: 'copy' });
      if (items.length) items.push({ type: 'separator' });
      items.push(
        { label: 'رجوع', enabled: wc.navigationHistory.canGoBack(), click: () => this.back(tab.id) },
        { label: 'تقدم', enabled: wc.navigationHistory.canGoForward(), click: () => this.forward(tab.id) },
        { label: 'إعادة تحميل', click: () => this.reload(tab.id) },
        { type: 'separator' },
        { label: 'فحص العنصر (Inspect)', click: () => wc.inspectElement(p.x, p.y) });
      Menu.buildFromTemplate(items).popup();
    });
  }

  private onNavigated(tab: Tab, url: string, inPage: boolean) {
    if (tab.kind === 'internal') return; // internal pages keep their nova:// url
    tab.url = url;
    tab.title = tab.view.webContents.getTitle();
    // الـ History: بنسجل بس http/https وبس لو مش Private. الـ in-page (زي YouTube SPA) بيتسجل برضه.
    if (!this.privateMode && /^https?:/i.test(url) && !(inPage && url === tab.lastUrl)) {
      tab.lastVisitId = ctx.history.add(url, tab.title, tab.favicon ?? null);
    }
    tab.lastUrl = url;
    this.push();
  }

  // ---------- keyboard ----------
  private handleInput(event: Electron.Event, input: Electron.Input, wc: WebContents) {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    const tab = this.byWc.get(wc.id);
    if (tab?.internalName === 'shortcuts') return; // صفحة الاختصارات بتسجل المفاتيح بنفسها
    const combo = normalizeCombo({ key: input.key, control: input.control, alt: input.alt, shift: input.shift, meta: input.meta });
    if (!combo) return;

    if (this.matcher.isPending()) {
      const r = this.matcher.feed(combo);
      if (r.type !== 'none') {
        event.preventDefault();
        if (r.type === 'match') this.runShortcut(r.shortcut as ShortcutRow);
        return;
      }
    }
    if (this.runBuiltin(combo, input)) { event.preventDefault(); return; }
    if (hasModifiers(combo) || /^F\d+$/.test(stripModifiers(combo))) {
      const r = this.matcher.feed(combo);
      if (r.type !== 'none') {
        event.preventDefault();
        if (r.type === 'match') this.runShortcut(r.shortcut as ShortcutRow);
      }
    }
  }

  private runShortcut(s: ShortcutRow) {
    const a = this.active;
    if (s.openIn === 'current' && a) this.navigate(a.id, s.url); else this.createTab({ input: s.url });
  }

  private runBuiltin(combo: string, input: Electron.Input): boolean {
    const a = this.active;
    if (input.control && !input.alt) {
      if (input.key === '+' || input.key === '=') { this.zoomActive('in'); return true; }
      if (input.key === '-' || input.key === '_') { this.zoomActive('out'); return true; }
      if (input.key === '0') { this.zoomActive('reset'); return true; }
    }
    const digit = /^Ctrl\+([1-9])$/.exec(combo);
    if (digit) {
      const n = Number(digit[1]);
      const t = n === 9 ? this.tabs[this.tabs.length - 1] : this.tabs[n - 1];
      if (t) this.activate(t.id);
      return true;
    }
    switch (combo) {
      case 'Ctrl+T': this.createTab(); return true;
      case 'Ctrl+W': if (a) this.closeTab(a.id); return true;
      case 'Ctrl+Shift+T': this.reopenClosed(); return true;
      case 'Ctrl+N': new BrowserWindowController({ privateMode: false }); return true;
      case 'Ctrl+Shift+N': new BrowserWindowController({ privateMode: true }); return true;
      case 'Ctrl+L': case 'Alt+D': case 'F6':
        this.ui.webContents.focus(); this.ui.webContents.send('nova:focus-address'); return true;
      case 'Ctrl+R': case 'F5': if (a) this.reload(a.id); return true;
      case 'Ctrl+Shift+R': case 'Ctrl+F5': if (a) this.reload(a.id, true); return true;
      case 'Alt+Left': if (a) this.back(a.id); return true;
      case 'Alt+Right': if (a) this.forward(a.id); return true;
      case 'Ctrl+Tab': case 'Ctrl+PageDown': this.cycle(1); return true;
      case 'Ctrl+Shift+Tab': case 'Ctrl+PageUp': this.cycle(-1); return true;
      case 'F11': this.toggleFullscreen(); return true;
      case 'Ctrl+H': this.openInternal('history'); return true;
      case 'Ctrl+J': this.openInternal('downloads'); return true;
      case 'Ctrl+Shift+O': this.openInternal('bookmarks'); return true;
      case 'Ctrl+Shift+Delete': this.openInternal('settings'); return true;
      case 'Ctrl+D': this.toggleBookmarkActive(); return true;
      case 'F12': case 'Ctrl+Shift+I': if (a?.kind === 'web') a.view.webContents.toggleDevTools(); return true;
      default: return false;
    }
  }

  openInternal(name: InternalPage) {
    const existing = this.tabs.find((t) => t.internalName === name);
    if (existing) this.activate(existing.id); else this.createTab({ input: `nova://${name}` });
  }

  // ---------- layout & state ----------
  private layout() {
    if (this.win.isDestroyed()) return;
    const [w, h] = this.win.getContentSize();
    const full = this.win.isFullScreen();
    this.ui.setBounds({ x: 0, y: 0, width: w, height: h });
    this.ui.setVisible(!full);
    const top = full ? 0 : CHROME_HEIGHT;
    for (const t of this.tabs) {
      t.view.setBounds({ x: 0, y: top, width: w, height: Math.max(0, h - top) });
      t.view.setVisible(t.id === this.activeId && !t.error);
    }
  }

  getState(): WindowState {
    const tabs: TabInfo[] = this.tabs.map((t) => {
      const wc = t.view.webContents;
      const alive = !wc.isDestroyed();
      return {
        id: t.id,
        title: t.title || (t.internalName ? t.internalName : t.url) || 'New Tab',
        url: t.internalName === 'newtab' ? '' : t.url,
        favicon: t.favicon,
        loading: t.loading,
        canGoBack: alive && wc.navigationHistory.canGoBack(),
        canGoForward: alive && wc.navigationHistory.canGoForward(),
        pinned: t.pinned,
        active: t.id === this.activeId,
        zoomPercent: alive ? Math.round(Math.pow(1.2, wc.getZoomLevel()) * 100) : 100,
        internal: t.internalName,
        error: t.error
      };
    });
    return { tabs, activeId: this.activeId, privateMode: this.privateMode, fullscreen: this.win.isFullScreen(), profile: ctx.profile };
  }

  push() {
    if (this.pushQueued) return;
    this.pushQueued = true;
    setTimeout(() => {
      this.pushQueued = false;
      const wc = this.ui.webContents;
      if (!this.win.isDestroyed() && !wc.isDestroyed()) wc.send('nova:state', this.getState());
    }, 16);
  }

  tabMenu(id: number) {
    const t = this.tab(id);
    if (!t) return;
    Menu.buildFromTemplate([
      { label: 'تبويب جديد', click: () => this.createTab({ afterId: id }) },
      { label: 'إعادة تحميل', click: () => this.reload(id) },
      { label: 'تكرار التبويب', click: () => this.duplicate(id) },
      { label: t.pinned ? 'إلغاء التثبيت' : 'تثبيت التبويب', click: () => this.pin(id, !t.pinned) },
      { type: 'separator' },
      { label: 'إغلاق', click: () => this.closeTab(id) },
      { label: 'إغلاق التبويبات الأخرى', click: () => this.closeOthers(id) }
    ]).popup();
  }

  private onClosed() {
    for (const t of this.tabs) this.destroyView(t);
    this.tabs = [];
    ctx.privileged.delete(this.ui.webContents.id);
    if (!this.ui.webContents.isDestroyed()) this.ui.webContents.close();
    ctx.windows = ctx.windows.filter((w) => w !== this);
    if (this.privateMode) { void this.ses.clearStorageData(); void this.ses.clearCache(); }
  }
}
