export type InternalPage = 'newtab' | 'history' | 'bookmarks' | 'downloads' | 'settings' | 'shortcuts';

export interface TabInfo {
  id: number;
  title: string;
  url: string; // what the address bar shows ('' for new tab page)
  favicon?: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  pinned: boolean;
  active: boolean;
  zoomPercent: number;
  internal: InternalPage | null;
  error: { code: number; description: string; url: string } | null;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  searchEngineId: string;
  homepage: string; // '' = New Tab page
  shortcutTimeoutMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  searchEngineId: 'google',
  homepage: '',
  shortcutTimeoutMs: 1500
};

export interface WindowState {
  tabs: TabInfo[];
  activeId: number | null;
  privateMode: boolean;
  fullscreen: boolean;
  profile: ProfileInfo;
}

export interface ProfileInfo { id: string; name: string }

export interface VisitRow {
  id: number; url: string; title: string; hostname: string; domain: string;
  favicon: string | null; visitedAt: number; visitCount: number;
}

export interface HistoryFilter {
  search?: string;
  domain?: string;
  excludeDomains?: string[];
  from?: number; // inclusive, ms
  to?: number; // exclusive, ms
  limit?: number;
  offset?: number;
}

export interface DomainCount { domain: string; count: number }

export interface Bookmark {
  id: number; title: string; url: string; folder: string; favicon: string | null; createdAt: number;
}

export interface SearchEngine { id: string; name: string; urlTemplate: string }

export interface ShortcutRow {
  id: number; name: string; url: string; sequence: string[];
  openIn: 'new' | 'current'; enabled: boolean;
}

export type ShortcutSaveResult =
  | { ok: true; id: number }
  | { ok: false; errors: string[]; conflicts: { id: number; name: string }[] };

export interface DownloadEntry {
  id: string; filename: string; url: string; path: string;
  state: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted';
  received: number; total: number; startedAt: number; isPrivate: boolean;
}

export interface PermissionRow { origin: string; permission: string; decision: 'allow' | 'deny' }
