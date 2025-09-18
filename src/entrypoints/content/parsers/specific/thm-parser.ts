import { htmlToMarkdown } from '~/lib/markdown';
import type {
  ContentRoot,
  HtmlString,
  IParser,
  ParserContext,
  ToMarkdownOptions,
  ToMarkdownResult,
} from '~/types';

/**
 * TryHackMe parser
 * - Expande tasks colapsadas (headers com aria-controls="content-N")
 * - Extrai cada task (título + conteúdo expandido)
 * - Reescreve inputs de resposta como bloco de código "answer"
 * - Normaliza blocos <pre><code> (trim/dedent) para evitar deslocamento
 * - Fornece baseUrl para a pipeline de markdown (absolutização)
 */
export class THMParser implements IParser {
  name = 'tryhackme' as const;
  domains = [
    { pattern: 'tryhackme.com', priority: 5 },
    { pattern: '*.tryhackme.com', priority: 3 },
  ];

  match(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname.endsWith('tryhackme.com') || u.hostname.endsWith('.tryhackme.com');
    } catch {
      return false;
    }
  }

  async extract(document: Document, _ctx?: ParserContext) {
    await expandAllTasks(document);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-export', 'thm');

    const roomTitle =
      (document.querySelector<HTMLElement>('h1[data-sentry-element="StyledTitleText"]')?.innerText?.trim()) ||
      document.title ||
      '';

    if (roomTitle) {
      const h1 = document.createElement('h1');
      h1.textContent = roomTitle;
      wrapper.appendChild(h1);
    }

    const headers = Array.from(document.querySelectorAll<HTMLElement>('[id^="header-"][aria-controls]'));
    for (const header of headers) {
      const controlsId = header.getAttribute('aria-controls') || '';
      const title =
        header.querySelector<HTMLElement>('[data-testid^="title-"]')?.innerText?.trim() ||
        header.innerText?.trim() ||
        '';

      const section = document.createElement('section');
      section.setAttribute('data-task', controlsId.replace(/^content-/, '') || '');
      if (title) {
        const h2 = document.createElement('h2');
        h2.textContent = title;
        section.appendChild(h2);
      }

      const content = controlsId ? document.getElementById(controlsId) : null;
      const resolvedContent = content || findContentSibling(header);

      if (resolvedContent) {
        const clone = resolvedContent.cloneNode(true) as HTMLElement;
        normalizeTryHackMeContent(clone);
        section.appendChild(clone);
      }

      wrapper.appendChild(section);
    }

    const html = (wrapper.innerHTML as unknown) as HtmlString;
    return { title: roomTitle || document.title, contentHtml: html };
  }

  async toMarkdown(
    input: HtmlString | string | ContentRoot,
    options: ToMarkdownOptions
  ): Promise<ToMarkdownResult> {
    const html = typeof input === 'string' ? input : ('' as HtmlString);
    return htmlToMarkdown(html, { ...options, baseUrl: location.href });
  }
}

/* ---------------- helpers específicos THM ---------------- */

async function expandAllTasks(doc: Document, timeoutMs = 3000): Promise<void> {
  const headers = Array.from(doc.querySelectorAll<HTMLElement>('[id^="header-"][aria-controls]'));
  const t0 = Date.now();

  for (const h of headers) {
    const controlsId = h.getAttribute('aria-controls') || '';
    const contentEl = controlsId ? doc.getElementById(controlsId) : null;

    const alreadyExpanded = h.getAttribute('aria-expanded') === 'true';
    if (alreadyExpanded && contentEl && contentEl.children.length > 0) continue;

    // dispara click (caso a UI seja controlada por event handlers React)
    try { h.click(); } catch {}
    // algumas UIs só montam ao dar scroll
    try { h.scrollIntoView({ block: 'center' }); } catch {}

    // espera o container aparecer/preencher
    const remaining = Math.max(200, timeoutMs - (Date.now() - t0));
    await waitFor(() => {
      const c = controlsId ? doc.getElementById(controlsId) : null;
      return !!(c && c.children && c.children.length > 0);
    }, remaining);
  }
}

function findContentSibling(header: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = header;
  for (let i = 0; i < 4 && el; i++) {
    el = (el.nextElementSibling as HTMLElement) || null;
    if (!el) continue;
    if (el.id?.startsWith('content-') || (el.getAttribute('data-testid') || '').startsWith('content-')) {
      return el;
    }
    if (el.querySelector && el.querySelector('[id^="content-"], [data-testid^="content-"]')) {
      return el.querySelector<HTMLElement>('[id^="content-"], [data-testid^="content-"]')!;
    }
  }
  return null;
}

function normalizeTryHackMeContent(root: HTMLElement): void {
  root.querySelectorAll('nav, aside, footer, script, style, [role="tooltip"], [data-testid="sidebar"]').forEach(n => n.remove());

  root.querySelectorAll<HTMLInputElement>('input[id][name][data-testid="answer-field"], input[data-testid="answer-field"]').forEach(inp => {
    const val = (inp.value || inp.placeholder || '').trim() || '';
    const pre = root.ownerDocument!.createElement('pre');
    const code = root.ownerDocument!.createElement('code');
    code.className = 'language-answer';
    code.textContent = val || 'No answer';
    pre.appendChild(code);
    inp.replaceWith(pre);
  });

  root.querySelectorAll<HTMLTextAreaElement>('textarea[data-testid="answer-field"]').forEach(ta => {
    const val = (ta.value || ta.placeholder || '').trim() || '';
    const pre = root.ownerDocument!.createElement('pre');
    const code = root.ownerDocument!.createElement('code');
    code.className = 'language-answer';
    code.textContent = val || 'No answer';
    pre.appendChild(code);
    ta.replaceWith(pre);
  });

  root.querySelectorAll<HTMLElement>('button[data-sentry-element="StyledButton"], button.sc-imWYAI, button.sc-jIFxHq').forEach(btn => {
    if (btn.dataset.sentryElement === 'StyledHintButton') {
      btn.remove();
      return
    }
    const txt = btn.innerText?.trim() || '';
    if (txt) {
      const bq = root.ownerDocument!.createElement('blockquote');
      bq.textContent = txt;
      btn.replaceWith(bq);
    } else {
      btn.remove();
    }
  });

  root.querySelectorAll<HTMLElement>('[data-sentry-element="StyledTextContainer"], [data-sentry-element="StyledTitleContainer"]').forEach(el => {
    const txt = el.innerText?.trim();
    if (!txt) { el.remove(); return; }
    const p = root.ownerDocument!.createElement('p');
    p.textContent = txt;
    el.replaceWith(p);
  });

  root.querySelectorAll<HTMLElement>('pre code, pre').forEach((el) => {
    normalizeCodePre(el);
  });

  root.querySelectorAll<HTMLElement>('*').forEach((n) => {
    const tag = n.tagName.toLowerCase();
    const cls = n.getAttribute('class') || '';
    const langClasses = cls.match(/\blanguage-[A-Za-z0-9+#-]+\b/g) || [];

    Array.from(n.attributes).forEach((attr) => {
      const name = attr.name;
      if (name.startsWith('data-sentry-') || name.startsWith('data-testid') || name.startsWith('aria-')) {
        n.removeAttribute(name);
        return;
      }

      if (name === 'class') {
        if ((tag === 'code' || tag === 'pre') && langClasses.length) {
          n.setAttribute('class', langClasses.join(' '));
        } else {
          n.removeAttribute('class');
        }
      }
    });
  });
}

function normalizeCodePre(el: HTMLElement): void {
  let txt: string | null = null;
  if (el.tagName.toLowerCase() === 'code') {
    txt = el.textContent;
  } else if (el.tagName.toLowerCase() === 'pre') {
    const code = el.querySelector('code');
    txt = code?.textContent ?? el.textContent;
  } else {
    txt = el.textContent;
  }
  if (txt == null) return;
  let lines = txt.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length === 0) {
    setElementText(el, '');
    return;
  }
  let minIndent: number | null = null;
  for (const l of lines) {
    if (l.trim() === '') continue;
    const m = l.match(/^(\s*)/);
    const indent = m ? m[1].length : 0;
    if (minIndent === null || indent < minIndent) minIndent = indent;
  }
  if (minIndent === null) minIndent = 0;
  if (minIndent > 0) {
    lines = lines.map((l) => (l.length >= minIndent ? l.slice(minIndent) : l.trimStart()));
  }
  const normalized = lines.join('\n');
  setElementText(el, normalized);
}

function setElementText(el: HTMLElement, txt: string) {
  if (el.tagName.toLowerCase() === 'pre') {
    const code = el.querySelector('code');
    if (code) {
      code.textContent = txt;
    } else {
      el.textContent = txt;
    }
  } else if (el.tagName.toLowerCase() === 'code') {
    el.textContent = txt;
  } else {
    el.textContent = txt;
  }
}

async function waitFor(pred: () => boolean, maxMs = 2000, intervalMs = 80): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      if (pred()) return;
    } catch {
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}
