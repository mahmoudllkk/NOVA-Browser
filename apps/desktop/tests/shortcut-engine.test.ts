import { describe, expect, it } from 'vitest';
import { SequenceMatcher, findConflicts, validateSequence, type SeqShortcut } from '../src/shared/shortcut-engine';
import { normalizeCombo } from '../src/shared/keys';

const list: SeqShortcut[] = [
  { id: 1, sequence: ['Ctrl+Y', 'Y'], enabled: true },
  { id: 2, sequence: ['Ctrl+G'], enabled: true },
  { id: 3, sequence: ['Ctrl+K', 'K'], enabled: false }
];

function make() {
  let t = 1000;
  const m = new SequenceMatcher(() => list, () => 1500, () => t);
  return { m, advance: (ms: number) => (t += ms) };
}

describe('SequenceMatcher', () => {
  it('matches a two-step sequence', () => {
    const { m } = make();
    expect(m.feed('Ctrl+Y').type).toBe('pending');
    const r = m.feed('Y');
    expect(r.type).toBe('match');
    if (r.type === 'match') expect(r.shortcut.id).toBe(1);
  });
  it('accepts the second step while Ctrl is still held', () => {
    const { m } = make();
    m.feed('Ctrl+Y');
    expect(m.feed('Ctrl+Y').type).toBe('match');
  });
  it('matches single-step shortcuts immediately', () => {
    expect(make().m.feed('Ctrl+G').type).toBe('match');
  });
  it('expires after the timeout', () => {
    const { m, advance } = make();
    m.feed('Ctrl+Y');
    advance(2000);
    expect(m.feed('Y').type).toBe('none');
  });
  it('ignores disabled shortcuts', () => {
    expect(make().m.feed('Ctrl+K').type).toBe('none');
  });
  it('restarts when a wrong key breaks the sequence', () => {
    const { m } = make();
    m.feed('Ctrl+Y');
    expect(m.feed('Ctrl+G').type).toBe('match');
  });
});

describe('validation & conflicts', () => {
  it('requires a modifier on the first step', () => expect(validateSequence(['Y'])).not.toBeNull());
  it('rejects reserved combos', () => expect(validateSequence(['Ctrl+T'])).not.toBeNull());
  it('accepts a good sequence', () => expect(validateSequence(['Ctrl+Y', 'Y'])).toBeNull());
  it('accepts F-keys without modifier', () => expect(validateSequence(['F2'])).toBeNull());
  it('detects equal and prefix conflicts', () => {
    expect(findConflicts(['Ctrl+Y', 'Y'], list).map((x) => x.id)).toEqual([1]);
    expect(findConflicts(['Ctrl+Y'], list).map((x) => x.id)).toEqual([1]);
    expect(findConflicts(['Ctrl+G', 'G'], list).map((x) => x.id)).toEqual([2]);
    expect(findConflicts(['Ctrl+K', 'K'], list)).toEqual([]); // disabled
  });
});

describe('normalizeCombo', () => {
  it('builds canonical names', () => {
    expect(normalizeCombo({ key: 'y', control: true, alt: false, shift: false, meta: false })).toBe('Ctrl+Y');
    expect(normalizeCombo({ key: 'Tab', control: true, alt: false, shift: true, meta: false })).toBe('Ctrl+Shift+Tab');
    expect(normalizeCombo({ key: 'Control', control: true, alt: false, shift: false, meta: false })).toBeNull();
  });
});
