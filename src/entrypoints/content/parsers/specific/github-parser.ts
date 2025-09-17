import type {
  IParser,
  ExtractResult,
  ToMarkdownOptions,
  ToMarkdownResult,
  HtmlString,
  ContentRoot
} from '~/types';
import { htmlToMarkdown } from '~/lib/markdown';

/** Parser para README do GitHub (view de repositório) */
export class GithubReadmeParser implements IParser {
  name = 'github-readme' as const;
  domains = [{ pattern: 'github.com', priority: 2 }];

  match(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.hostname !== 'github.com') return false;
      return /^\/[^/]+\/[^/]+(\/?$|\/(tree|blob)\/)/.test(u.pathname);
    } catch {
      return false;
    }
  }

  async extract(document: Document): Promise<ExtractResult> {
    const readme = document.querySelector('#readme article') || document.querySelector('#readme');
    const title =
      document.querySelector('strong.mr-2.flex-self-stretch')?.textContent?.trim() ||
      document.querySelector('h1 strong a')?.textContent?.trim() ||
      document.title;

    return {
      title: title ? `${title} - README` : 'README',
      contentHtml: (readme?.innerHTML ?? '') as HtmlString,
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
