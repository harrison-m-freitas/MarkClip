// src/content/main.ts (apenas as linhas impactadas)
import { ParserRegistry } from './parsers';
import type { ExportOptions, ISODate } from '~/types'; 

const DEFAULTS: ExportOptions = {
  embedImages: false,
  includeMetadata: true,
  parser: 'auto'
};

async function getOptions(): Promise<ExportOptions> {
  const r = await chrome.storage.sync.get(['embedImages', 'includeMetadata', 'parser']);
  return {
    embedImages: r.embedImages ?? DEFAULTS.embedImages,
    includeMetadata: r.includeMetadata ?? DEFAULTS.includeMetadata,
    parser: (r.parser as any) ?? DEFAULTS.parser
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'EXPORT_MARKDOWN') {
    exportCurrentPage().then(sendResponse);
    return true;
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
