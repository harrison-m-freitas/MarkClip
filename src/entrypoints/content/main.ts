// src/content/main.ts (apenas as linhas impactadas)
import { ParserRegistry } from './parsers';
import type { ExportOptions, ISODate } from '~/types'; 

const DEFAULTS: ExportOptions = {
  embedImages: false,
  includeMetadata: true,
  parser: 'auto'
};

async function getOptions(): Promise<ExportOptions> {
  const r = await browser.storage.sync.get(['embedImages', 'includeMetadata', 'parser']);
  return {
    embedImages: r.embedImages ?? DEFAULTS.embedImages,
    includeMetadata: r.includeMetadata ?? DEFAULTS.includeMetadata,
    parser: (r.parser as any) ?? DEFAULTS.parser
  };
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'EXPORT_MARKDOWN') {
    return exportCurrentPage();
  }
  if (msg?.type === 'FORCE_DOWNLOAD_FALLBACK') {
    const { filename, markdown } = msg as { filename: string; markdown: string };
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'export.md';
      a.rel = 'noopener';
      a.style.display = 'none';
      document.documentElement.appendChild(a);
      a.click();
      a.remove();
      // dá um tempo pequeno para o navegador capturar o blob
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return Promise.resolve({ ok: true });
    } catch (e) {
      console.error('[CS] Fallback de download falhou', e);
      return Promise.resolve({ ok: false, error: String(e) });
    }
  }
});

async function exportCurrentPage() {
  const opts = await getOptions();

  const registry = new ParserRegistry();
  const resolution = registry.resolve(location.href, document, opts.parser);
  const parser = resolution.selected;

  const { contentHtml, title } = await parser.extract(document);

  const dateIso = new Date().toISOString().slice(0, 10) as ISODate;
  const fm = opts.includeMetadata
    ? {
        title: title || document.title || '',
        source_url: location.href,
        date: dateIso,
      }
    : undefined;

  const { markdown } = await parser.toMarkdown(contentHtml, {
    embedImages: opts.embedImages,
    frontmatter: fm,
  });

  const safeTitle =
    (title || document.title || 'export').replace(/[\\/:*?"<>|]/g, '_').trim() || 'export';
  const filename = `${safeTitle}.md`;

  return { ok: true, markdown, filename };
}
