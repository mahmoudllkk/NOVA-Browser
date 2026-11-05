// Netscape bookmark file format (Chrome / Firefox / Edge compatible). Pure functions.

export interface BookmarkItem { title: string; url: string; folder: string; createdAt: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function serializeBookmarks(items: BookmarkItem[]): string {
  const groups = new Map<string, BookmarkItem[]>();
  for (const b of items) groups.set(b.folder, [...(groups.get(b.folder) ?? []), b]);
  const link = (b: BookmarkItem) =>
    `<DT><A HREF="${esc(b.url)}" ADD_DATE="${Math.floor(b.createdAt / 1000)}">${esc(b.title)}</A>`;
  const lines = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>', '<H1>Bookmarks</H1>', '<DL><p>'];
  for (const b of groups.get('') ?? []) lines.push('    ' + link(b));
  for (const [folder, list] of groups) {
    if (folder === '') continue;
    lines.push(`    <DT><H3>${esc(folder)}</H3>`, '    <DL><p>', ...list.map((b) => '        ' + link(b)), '    </DL><p>');
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}

export function parseBookmarks(html: string): BookmarkItem[] {
  const out: BookmarkItem[] = [];
  const stack: string[] = [];
  let pending: string | null = null;
  const re = /<H3[^>]*>([\s\S]*?)<\/H3>|<A\s[^>]*?HREF="([^"]*)"[^>]*>([\s\S]*?)<\/A>|<DL[^>]*>|<\/DL>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0].toUpperCase();
    if (tag.startsWith('<H3')) pending = unesc(m[1]).trim();
    else if (tag.startsWith('<A')) {
      const url = unesc(m[2]).trim();
      if (/^https?:\/\//i.test(url)) {
        const add = /ADD_DATE="(\d+)"/i.exec(m[0]);
        out.push({
          title: unesc(m[3].replace(/<[^>]*>/g, '')).trim() || url,
          url,
          folder: stack.filter(Boolean).join('/'),
          createdAt: add ? Number(add[1]) * 1000 : Date.now()
        });
      }
    } else if (tag.startsWith('<DL')) { stack.push(pending ?? ''); pending = null; }
    else stack.pop();
  }
  return out;
}
