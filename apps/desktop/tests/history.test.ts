import { describe, expect, it } from 'vitest';
import { buildWhere, escapeLike } from '../src/main/db/history-query';
import { domainInfo } from '../src/shared/domain';

describe('domainInfo', () => {
  it('groups subdomains under the registrable domain', () => {
    expect(domainInfo('https://m.youtube.com/watch?v=1').domain).toBe('youtube.com');
    expect(domainInfo('https://www.facebook.com/x').domain).toBe('facebook.com');
  });
  it('does not confuse look-alike domains', () => {
    expect(domainInfo('https://notyoutube.com/').domain).toBe('notyoutube.com');
    expect(domainInfo('https://youtube.com.evil.io/').domain).toBe('evil.io');
  });
  it('handles multi-part public suffixes', () => {
    expect(domainInfo('https://www.bbc.co.uk/news').domain).toBe('bbc.co.uk');
  });
  it('falls back to hostname for localhost and IPs', () => {
    expect(domainInfo('http://localhost:3000/').domain).toBe('localhost');
    expect(domainInfo('http://192.168.1.1/').domain).toBe('192.168.1.1');
  });
});

describe('buildWhere', () => {
  it('is empty without filters', () => expect(buildWhere({})).toEqual({ sql: '', params: [] }));
  it('combines filters with AND', () => {
    const r = buildWhere({ search: 'cat', domain: 'youtube.com', from: 1, to: 2 });
    expect(r.sql).toContain('domain = ?');
    expect(r.sql).toContain('visited_at >= ?');
    expect(r.sql).toContain('visited_at < ?');
    expect(r.params).toEqual(['%cat%', '%cat%', 'youtube.com', 1, 2]);
  });
  it('supports excluding domains ("Other")', () => {
    const r = buildWhere({ excludeDomains: ['a.com', 'b.com'] });
    expect(r.sql).toBe('WHERE domain NOT IN (?,?)');
    expect(r.params).toEqual(['a.com', 'b.com']);
  });
  it('escapes LIKE wildcards in the search text', () => {
    expect(escapeLike('50%_off')).toBe('50\\%\\_off');
    expect(buildWhere({ search: '100%' }).params[0]).toBe('%100\\%%');
  });
});
