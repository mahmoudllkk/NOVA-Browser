import { INTERNAL_PAGE_NAMES } from './pages';
import type { InternalPage } from './types';

export type Target = { type: 'internal'; name: InternalPage } | { type: 'web'; url: string };

const HOST_LIKE = /^[^\s/?#]+\.[^\s/?#.]{2,}([:/?#]\S*)?$/;
const LOCAL_LIKE = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#]\S*)?$/i;
const BLOCKED_SCHEMES = /^(javascript|file|data|vbscript|about|chrome|view-source|blob):/i;

function validHttp(u: string): string | null {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.href : null;
  } catch { return null; }
}

/** Accepts "youtube.com", "http://x.y", "localhost:3000". Returns null for anything that is not a web address. */
export function normalizeUserUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t || /\s/.test(t)) return null;
  if (/^https?:\/\//i.test(t)) return validHttp(t);
  if (BLOCKED_SCHEMES.test(t)) return null;
  if (LOCAL_LIKE.test(t)) return validHttp('http://' + t);
  if (HOST_LIKE.test(t)) return validHttp('https://' + t);
  return null;
}

/** Decides what the address bar text means: internal page, web address, or a search. */
export function resolveInput(raw: string, searchTemplate: string): Target | null {
  const t = raw.trim();
  if (!t) return null;
  const internal = /^nova:\/\/([a-z]+)\/?$/i.exec(t);
  if (internal) {
    const name = internal[1].toLowerCase();
    return (INTERNAL_PAGE_NAMES as readonly string[]).includes(name) ? { type: 'internal', name: name as InternalPage } : null;
  }
  if (/^nova:/i.test(t)) return null;
  if (BLOCKED_SCHEMES.test(t) && !/^https?:\/\//i.test(t)) return null;
  const url = normalizeUserUrl(t);
  if (url) return { type: 'web', url };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return null; // unknown scheme, don't search it
  const search = validHttp(searchTemplate.replace('%s', encodeURIComponent(t)));
  return search ? { type: 'web', url: search } : null;
}
