// src/lib/debug.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function readFlag(k: string): boolean {
  try {
    const v = (localStorage.getItem(k) || '').toLowerCase();
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export function flag(ns: string): boolean {
  // ex.: md.debug.export, md.debug.codes, md.debug.parsers, md.fix.nbsp
  return readFlag(ns);
}

export function dlog(ns: string, ...args: unknown[]) {
  if (flag(`md.debug.${ns}`)) console.debug(`[MarkClip:${ns}]`, ...args);
}

export function dgroup(ns: string, label: string, cb: () => void) {
  if (!flag(`md.debug.${ns}`)) return;
  console.groupCollapsed(`[MarkClip:${ns}] ${label}`);
  try { cb(); } finally { console.groupEnd(); }
}

export function dtimer(ns: string, label: string) {
  const on = flag(`md.debug.${ns}`);
  const key = `[MarkClip:${ns}] ${label}`;
  if (!on) return { end() {} };
  console.time(key);
  return { end() { console.timeEnd(key); } };
}

/** Mostra caracteres invisíveis pra facilitar visual */
export function revealSpaces(s: string): string {
  return s
    .replace(/\u00A0/g, '⍽')    // NBSP
    .replace(/\t/g, '→\t')      // TAB marcador
    .replace(/ /g, '·');        // espaço normal
}

export function sampleLines(s: string, max = 8): string {
  const lines = s.replace(/\r\n?/g, '\n').split('\n');
  const head = lines.slice(0, max).join('\n');
  const tail = lines.length > max ? `\n…(+${lines.length - max} linhas)` : '';
  return head + tail;
}
