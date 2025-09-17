import type {
  IParser,
  ExtractResult,
  ToMarkdownOptions,
  ToMarkdownResult,
  HtmlString,
  ContentRoot,
} from '~/types';
import { htmlToMarkdown } from '~/lib/markdown';

/** Parser simples para artigos do Medium */
export class MediumParser implements IParser {
  name = 'medium' as const;
  domains = [
    { pattern: 'medium.com', priority: 5 },
    { pattern: '*.medium.com', priority: 3 },
  ];

  match(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname.endsWith('medium.com') || u.hostname.endsWith('.medium.com');
    } catch {
      return false;
    }
  }

  async extract(document: Document): Promise<ExtractResult> {
    const root =
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[data-test-id="post-content"]') ||
      document.body;

    root?.querySelectorAll('nav,aside,footer,[data-test-id="sticker"]').forEach((n) => n.remove());

    const title =
      document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('header h1')?.textContent?.trim() ||
      document.title;

    return { title, contentHtml: (root?.innerHTML ?? '') as HtmlString };
  }

  async toMarkdown(
    input: HtmlString | string | ContentRoot,
    options: ToMarkdownOptions
  ): Promise<ToMarkdownResult> {
    const html = typeof input === 'string'
      ? input
      : ('' as HtmlString);
    return htmlToMarkdown(html, options);
  }
}
