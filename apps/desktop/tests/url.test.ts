import { describe, expect, it } from 'vitest';
import { normalizeUserUrl, resolveInput } from '../src/shared/url';

const T = 'https://www.google.com/search?q=%s';

describe('resolveInput', () => {
  it('adds https to bare domains', () => expect(resolveInput('youtube.com', T)).toEqual({ type: 'web', url: 'https://youtube.com/' }));
  it('keeps explicit URLs', () => expect(resolveInput('http://example.com/a?b=1', T)).toEqual({ type: 'web', url: 'http://example.com/a?b=1' }));
  it('uses http for localhost', () => expect(resolveInput('localhost:3000', T)).toEqual({ type: 'web', url: 'http://localhost:3000/' }));
  it('searches plain text', () => {
    const r = resolveInput('hello world', T);
    expect(r).toEqual({ type: 'web', url: 'https://www.google.com/search?q=hello%20world' });
  });
  it('maps nova:// pages', () => expect(resolveInput('nova://history', T)).toEqual({ type: 'internal', name: 'history' }));
  it('rejects unknown nova pages and dangerous schemes', () => {
    expect(resolveInput('nova://nothing', T)).toBeNull();
    expect(resolveInput('javascript:alert(1)', T)).toBeNull();
    expect(resolveInput('file:///C:/secret.txt', T)).toBeNull();
    expect(resolveInput('data:text/html,hi', T)).toBeNull();
  });
  it('returns null for empty input', () => expect(resolveInput('   ', T)).toBeNull());
});

describe('normalizeUserUrl', () => {
  it('rejects non-web input', () => {
    expect(normalizeUserUrl('hello world')).toBeNull();
    expect(normalizeUserUrl('ftp://x.com')).toBeNull();
  });
});
