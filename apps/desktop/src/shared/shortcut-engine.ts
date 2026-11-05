// Pure logic (no Electron) so it can be unit-tested.

export const RESERVED_COMBOS = new Set([
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+A', 'Ctrl+Z', 'Ctrl+T', 'Ctrl+W', 'Ctrl+N', 'Ctrl+L', 'Ctrl+R',
  'Ctrl+D', 'Ctrl+H', 'Ctrl+J', 'Ctrl+P', 'Ctrl+S', 'Ctrl+Q', 'Ctrl+Tab', 'Ctrl+Shift+Tab',
  'Ctrl+Shift+N', 'Ctrl+Shift+T', 'Ctrl+Shift+R', 'Ctrl+Shift+O', 'Ctrl+Shift+I', 'Ctrl+Shift+Delete',
  'Alt+F4', 'Alt+Left', 'Alt+Right', 'Alt+D', 'F5', 'F6', 'F11', 'F12', 'Ctrl+0', 'Ctrl+=', 'Ctrl+-'
]);

const MOD = /^(Ctrl|Alt|Shift|Meta)\+/;

export function stripModifiers(c: string): string {
  let s = c;
  while (MOD.test(s)) s = s.replace(MOD, '');
  return s;
}
export function hasModifiers(c: string): boolean { return stripModifiers(c) !== c; }
function hasPrimaryModifier(c: string): boolean {
  const mods = c.slice(0, c.length - stripModifiers(c).length);
  return /(Ctrl|Alt|Meta)/.test(mods);
}
const isFKey = (c: string) => /^F([1-9]|1[0-2])$/.test(stripModifiers(c));

export interface SeqShortcut { id: number; sequence: string[]; enabled: boolean }

/** Returns an Arabic error message or null when valid. */
export function validateSequence(seq: string[]): string | null {
  if (!Array.isArray(seq) || seq.length === 0) return 'لازم تضيف خطوة واحدة على الأقل';
  if (seq.length > 4) return 'الحد الأقصى 4 خطوات';
  if (seq.some((s) => typeof s !== 'string' || stripModifiers(s) === '')) return 'فيه خطوة غير صالحة';
  const first = seq[0];
  if (!hasPrimaryModifier(first) && !isFKey(first)) {
    return 'الخطوة الأولى لازم تحتوي على Ctrl أو Alt أو Meta (أو تكون F1-F12) عشان متتعارضش مع الكتابة العادية';
  }
  if (RESERVED_COMBOS.has(first)) return `الاختصار ${first} محجوز للمتصفح أو النظام ومينفعش يتغير`;
  return null;
}

/** Shortcuts that clash: same sequence, or one is a prefix of the other. */
export function findConflicts<T extends SeqShortcut>(candidate: string[], others: T[]): T[] {
  return others.filter((o) => {
    if (!o.enabled) return false;
    const n = Math.min(o.sequence.length, candidate.length);
    for (let i = 0; i < n; i++) if (o.sequence[i] !== candidate[i]) return false;
    return true;
  });
}

export type MatchResult =
  | { type: 'none' }
  | { type: 'pending' }
  | { type: 'match'; shortcut: SeqShortcut };

export class SequenceMatcher {
  private buffer: string[] = [];
  private lastAt = 0;

  constructor(
    private getShortcuts: () => SeqShortcut[],
    private getTimeoutMs: () => number,
    private now: () => number = Date.now
  ) {}

  isPending(): boolean {
    this.expire();
    return this.buffer.length > 0;
  }
  reset() { this.buffer = []; }

  private expire() {
    if (this.buffer.length && this.now() - this.lastAt > this.getTimeoutMs()) this.buffer = [];
  }

  // Later steps may be pressed while Ctrl is still held: "Y" also matches "Ctrl+Y".
  private stepMatches(def: string, input: string, index: number): boolean {
    if (def === input) return true;
    return index > 0 && !hasModifiers(def) && stripModifiers(input) === def;
  }

  private evaluate(cands: string[]): MatchResult {
    let exact: SeqShortcut | null = null;
    let longer = false;
    for (const s of this.getShortcuts()) {
      if (!s.enabled || s.sequence.length < cands.length) continue;
      if (!cands.every((c, i) => this.stepMatches(s.sequence[i], c, i))) continue;
      if (s.sequence.length === cands.length) exact = exact ?? s;
      else longer = true;
    }
    if (exact) return { type: 'match', shortcut: exact };
    return longer ? { type: 'pending' } : { type: 'none' };
  }

  feed(combo: string): MatchResult {
    this.expire();
    let used = [...this.buffer, combo];
    let r = this.evaluate(used);
    if (r.type === 'none' && this.buffer.length) {
      used = [combo];
      r = this.evaluate(used);
    }
    if (r.type === 'pending') {
      this.buffer = used;
      this.lastAt = this.now();
    } else {
      this.buffer = [];
    }
    return r;
  }
}
