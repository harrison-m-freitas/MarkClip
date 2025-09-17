import type {
  IParser,
  ExtractResult,
  ToMarkdownOptions,
  ToMarkdownResult,
  HtmlString,
  ContentRoot,
} from '~/types';import { htmlToMarkdown } from '~/lib/markdown';
import { Readability } from '@mozilla/readability';

export class GenericParser implements IParser {
  name = 'generic' as const;

  match(_url: string): boolean {
    return true;
  }

  async extract(document: Document): Promise<ExtractResult> {
    try {
      const docClone = document.cloneNode(true) as Document;
      const article = new Readability(docClone).parse();
      if (article?.content) {
        return { title: article.title ?? document.title, contentHtml: article.content as HtmlString };
      }
    } catch {
      // fallback
    }
    const root =
      document.querySelector('main article') ||
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.body;
    return {
      title: document.title,
      contentHtml: (root?.innerHTML ?? document.body.innerHTML) as HtmlString,
    };
  }

  async toMarkdown(
    input: HtmlString | string | ContentRoot,
    options: ToMarkdownOptions
  ): Promise<ToMarkdownResult> {
    const html = typeof input === 'string'
      ? input
      : ('' as HtmlString); // fallback simples
    return htmlToMarkdown(html, options);
  }
}
