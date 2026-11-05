import { parse } from 'tldts';

/** domain = registrable domain (m.youtube.com -> youtube.com). For localhost/IPs it is the hostname. */
export function domainInfo(url: string): { hostname: string; domain: string } {
  const p = parse(url);
  const hostname = p.hostname ?? '';
  return { hostname, domain: p.domain ?? hostname };
}
