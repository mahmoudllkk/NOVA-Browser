export interface KeyInput { key: string; control: boolean; alt: boolean; shift: boolean; meta: boolean }

const IGNORED = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'Dead', 'Process', 'CapsLock']);
const NAMES: Record<string, string> = {
  ' ': 'Space', ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Esc: 'Escape'
};

/** Turns a key event into a canonical combo like "Ctrl+Shift+Y". Returns null for modifier-only presses. */
export function normalizeCombo(i: KeyInput): string | null {
  if (!i.key || IGNORED.has(i.key)) return null;
  const k = i.key.length === 1 ? i.key.toUpperCase() : NAMES[i.key] ?? i.key;
  const parts: string[] = [];
  if (i.control) parts.push('Ctrl');
  if (i.alt) parts.push('Alt');
  if (i.shift) parts.push('Shift');
  if (i.meta) parts.push('Meta');
  parts.push(k);
  return parts.join('+');
}
