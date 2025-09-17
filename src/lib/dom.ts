/**
 * src/lib/dom.ts
 * Utilitários de DOM para extração e normalização antes da conversão.
 */

import type { HtmlString, URLString } from '~/types';
import { Readability } from '@mozilla/readability';

/** Seletores comuns a remover durante a limpeza */
const STRIP_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe[title="advertisement"]',
  'nav',
  'aside',
  'footer',
  '#cookie-banner',
  '[aria-label="cookie banner"]',
  '[role="banner"]',
  '[role="navigation"]',
  '[data-testid="sidebar"]',
  '.sidebar',
  '.advertisement',
  '.adsbygoogle',
  '[data-ad]',
];

/** Retorna o melhor container de conteúdo: Readability → heurística main/article → body */
export function selectMainContainer(document: Document): Element {
  // 1) Tenta Readability (clona o doc para evitar efeitos colaterais)
  try {
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (article?.content) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = article.content;
      return wrapper;
    }
  } catch {
    // segue para heurística
  }

  // 2) Heurística simples
  return (
    document.querySelector('main article') ||
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.body
  )!;
}

/** Remove ruído conhecido e elementos não textuais/úteis */
export function cleanContainer(root: Element): void {
  // Remove seletores conhecidos
  root.querySelectorAll(STRIP_SELECTORS.join(',')).forEach((el) => el.remove());

  // Remove comentários
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
  const toRemove: Comment[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Comment;
    toRemove.push(n);
  }
  toRemove.forEach((n) => n.remove());
}

/** Resolve URLs relativas para absolutas em href/src/srcset baseados no baseURL */
export function absolutizeUrls(root: Element, baseUrl: string): void {
  const base = new URL(baseUrl);

  // href
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    try {
      a.href = new URL(a.getAttribute('href')!, base).toString();
    } catch {
      // ignora
    }
  });

  // img src & srcset
  root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !isAbsoluteUrl(src)) {
      try {
        img.setAttribute('src', new URL(src, base).toString());
      } catch {
        /* noop */
      }
    }
    const srcset = img.getAttribute('srcset');
    if (srcset) img.setAttribute('srcset', normalizeSrcset(srcset, base));
  });

  // source[srcset] (picture/video)
  root.querySelectorAll<HTMLSourceElement>('source[src], source[srcset]').forEach((s) => {
    const src = s.getAttribute('src');
    if (src && !isAbsoluteUrl(src)) {
      try {
        s.setAttribute('src', new URL(src, base).toString());
      } catch {}
    }
    const srcset = s.getAttribute('srcset');
    if (srcset) s.setAttribute('srcset', normalizeSrcset(srcset, base));
  });
}

/** Extrai título preferindo <h1>, com fallback em document.title */
export function extractTitle(document: Document, container?: Element): string {
  const h1 = container?.querySelector('h1') || document.querySelector('h1');
  const t = h1?.textContent?.trim();
  return t && t.length > 0 ? t : (document.title || '').trim();
}

/** Serializa o container limpo para HTML (fragment) */
export function serializeHtml(root: Element): HtmlString {
  return (root.innerHTML as unknown) as HtmlString;
}

/** Helper de URL absoluta */
export function isAbsoluteUrl(s: string): boolean {
  try {
    // URL válido com protocolo
    // data:, blob:, http(s): — todos são absolutos
    return Boolean(new URL(s));
  } catch {
    return false;
  }
}

/** Utilitário para obter base URL "canônica" (considera <base href>) */
export function resolveBaseUrl(document: Document): URLString | string {
  const baseEl = document.querySelector('base[href]');
  if (baseEl) {
    const href = baseEl.getAttribute('href')!;
    try {
      return new URL(href, location.href).toString() as URLString;
    } catch {
      // fallback para location se inválido
    }
  }
  return location.href as URLString;
}

export function normalizeSrcset(srcset: string, base: URL): string {
  return srcset
    .split(',')
    .map((s) => s.trim())
    .map((item) => {
      const [u, w] = item.split(/\s+/);
      if (!u) return item;
      try {
        const abs = new URL(u, base).toString();
        return [abs, w].filter(Boolean).join(' ');
      } catch {
        return item;
      }
    })
    .join(', ');   
}