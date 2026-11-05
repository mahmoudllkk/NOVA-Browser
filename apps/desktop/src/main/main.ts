import { app, Menu, nativeTheme } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ctx } from './context';
import { ProfileStore } from './profiles';
import { openDatabase } from './db/database';
import { BookmarksRepo } from './db/bookmarks';
import { HistoryRepo } from './db/history';
import { EnginesRepo, PermissionsRepo, SettingsRepo } from './db/settings';
import { ShortcutsRepo } from './db/shortcuts';
import { DownloadManager } from './browser/downloads';
import { BrowserWindowController } from './browser/window';
import { registerIpc } from './ipc';

app.setName('NOVA Browser');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = ctx.windows[0];
    if (w) w.focus(); else new BrowserWindowController({ privateMode: false });
  });

  // أي <webview> من صفحة موقع ممنوع تمامًا.
  app.on('web-contents-created', (_e, wc) => wc.on('will-attach-webview', (ev) => ev.preventDefault()));

  app.whenReady().then(() => {
    const dev = process.env.NODE_ENV === 'development';
    ctx.appPage = dev ? 'http://localhost:5173/' : pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
    ctx.preloadPath = path.join(__dirname, '../preload/preload.js');

    ctx.profiles = new ProfileStore(app.getPath('userData'));
    ctx.profile = ctx.profiles.active();
    ctx.profilePartition = `persist:profile-${ctx.profile.id}`;
    ctx.db = openDatabase(path.join(ctx.profiles.dir(ctx.profile.id), 'nova.db'));
    ctx.engines = new EnginesRepo(ctx.db);
    ctx.settings = new SettingsRepo(ctx.db, ctx.engines);
    ctx.history = new HistoryRepo(ctx.db);
    ctx.bookmarks = new BookmarksRepo(ctx.db);
    ctx.shortcuts = new ShortcutsRepo(ctx.db);
    ctx.permissions = new PermissionsRepo(ctx.db);
    ctx.downloads = new DownloadManager(ctx.db);
    ctx.windows = [];
    ctx.privileged = new Set();

    nativeTheme.themeSource = ctx.settings.getAll().theme;
    Menu.setApplicationMenu(null);
    registerIpc();
    new BrowserWindowController({ privateMode: false });
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { try { ctx.db?.close(); } catch { /* already closed */ } });
}
