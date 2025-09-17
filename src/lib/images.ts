/**
 * src/lib/images.ts
 * Embed de imagens (data:URL), com timeout, limites e cache em memória.
 */

import type { DataUrlString, URLString } from '~/types';

const cache = new Map<string, DataUrlString>();

export interface EmbedOptions {
  timeoutMs?: number;      // padrão: 8000
  maxBytes?: number;       // padrão: 5 MiB
  allowedMime?: RegExp;    // padrão: /^image\//
  credentials?: RequestCredentials; // 'include' para usar cookies quando necessário
}

/** Converte uma URL de imagem para data:URL (respeitando limites e cache). */
export async function embedImageAsDataURLIfNeeded(
  url: string,
  opts: EmbedOptions = {},
): Promise<DataUrlString | null> {
  if (!url || url.startsWith('data:')) return (url as DataUrlString) ?? null;
  if (cache.has(url)) return cache.get(url)!;

  const {
    timeoutMs = 8000,
    maxBytes = 5 * 1024 * 1024,
    allowedMime = /^image\//i,
    credentials = 'include',
  } = opts;

  try {
    const res = await fetchWithTimeout(url, { credentials }, timeoutMs);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type')?.toLowerCase() || '';
    if (!allowedMime.test(contentType)) return null;

    // Lê como stream para checar tamanho
    const reader = res.body?.getReader();
    if (!reader) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBytes) return null;
      const b64 = arrayBufferToBase64(buf);
      const dataUrl = `data:${contentType};base64,${b64}` as DataUrlString;
      cache.set(url, dataUrl);
      return dataUrl;
    }

    let received = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > maxBytes) {
          try {
            reader.cancel();
          } catch {}
          return null;
        }
        chunks.push(value);
      }
    }

    const buf = concatUint8(chunks);
    const b64 = uint8ToBase64(buf);
    const dataUrl = `data:${contentType};base64,${b64}` as DataUrlString;
    cache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/** Fetch com timeout (AbortController) */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
  timeoutMs = 8000,
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), init.timeoutMs ?? timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Concatena chunks em um único Uint8Array */
function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return uint8ToBase64(new Uint8Array(buf));
}

function uint8ToBase64(u8: Uint8Array): string {
  let result = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    const chunk = u8.subarray(i, i + chunkSize);
    result += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }
  return btoa(result);
}
