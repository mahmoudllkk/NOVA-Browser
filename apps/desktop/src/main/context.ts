import { webContents } from 'electron';
import type Database from 'better-sqlite3';
import type { BookmarksRepo } from './db/bookmarks';
import type { EnginesRepo, PermissionsRepo, SettingsRepo } from './db/settings';
import type { HistoryRepo } from './db/history';
import type { ShortcutsRepo } from './db/shortcuts';
import type { DownloadManager } from './browser/downloads';
import type { BrowserWindowController } from './browser/window';
import type { ProfileStore } from './profiles';
import type { ProfileInfo } from '../shared/types';

export interface Ctx {
  appPage: string; // URL of the renderer index.html WITHOUT hash
  preloadPath: string;
  profile: ProfileInfo;
  profilePartition: string;
  profiles: ProfileStore;
  db: Database.Database;
  settings: SettingsRepo;
  engines: EnginesRepo;
  history: HistoryRepo;
  bookmarks: BookmarksRepo;
  shortcuts: ShortcutsRepo;
  permissions: PermissionsRepo;
  downloads: DownloadManager;
  windows: BrowserWindowController[];
  privileged: Set<number>; // webContents ids allowed to call the nova IPC API
}

export const ctx = {} as Ctx;

export const isAppUrl = (url: string) => url.split('#')[0] === ctx.appPage;

export function broadcast(channel: string, payload: unknown) {
  for (const id of ctx.privileged) {
    const wc = webContents.fromId(id);
    if (wc && !wc.isDestroyed()) wc.send(channel, payload);
  }
}
