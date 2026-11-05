import { describe, expect, it } from 'vitest';
import { parseBookmarks, serializeBookmarks } from '../src/shared/bookmarks-html';

describe('bookmarks html', () => {
  it('round-trips with folders and special characters', () => {
    const items = [
      { title: 'Root & co', url: 'https://a.com/?x=1&y=2', folder: '', createdAt: 1700000000000 },
      { title: 'موقع عربي', url: 'https://b.com/', folder: 'Work', createdAt: 1700000001000 }
    ];
    const back = parseBookmarks(serializeBookmarks(items));
    expect(back).toEqual(items);
  });
  it('ignores non-http links', () => {
    expect(parseBookmarks('<DL><DT><A HREF="javascript:alert(1)">x</A></DL>')).toEqual([]);
  });
  it('handles nested folders', () => {
    const html = '<DL><DT><H3>A</H3><DL><DT><H3>B</H3><DL><DT><A HREF="https://x.com/">x</A></DL></DL></DL>';
    expect(parseBookmarks(html)[0].folder).toBe('A/B');
  });
});
