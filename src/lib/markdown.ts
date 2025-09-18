/**
 * src/lib/markdown.ts
 * Pipeline unified (rehype → remark → stringify) com:
 * - Absolutização de URLs (links e imagens)
 * - Detecção de linguagem em blocos de código
 * - Embutir imagens via images.ts (quando configurado)
 * - GFM ativo e opções seguras de stringify
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Options as RemarkStringifyOptions } from 'remark-stringify';
import { visit } from 'unist-util-visit';

import type {
  ExportOptions,
  ToMarkdownOptions,
  ToMarkdownResult,
  Frontmatter,
  HtmlString,
  MarkdownString,
} from '~/types';

import { embedImageAsDataURLIfNeeded } from './images';
import { isAbsoluteUrl, normalizeSrcset } from './dom';
import { dlog, dgroup, dtimer, flag, revealSpaces, sampleLines } from './debug';

const stringifyOptions: RemarkStringifyOptions & { 'entities': string } = {
  fences: true,
  bullet: '-',
  rule: '-',
  fence: '`',
  listItemIndent: 'one',
  entities: 'escape',
  incrementListMarker: true,
}

/** Constrói frontmatter YAML simples (apenas chaves com valor) */
export function buildFrontmatter(fm?: Frontmatter): string {
  if (!fm) return '';
  const entries = Object.entries(fm).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  const lines = entries.map(([k, v]) => `${k}: ${yamlSerialize(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

function yamlSerialize(v: unknown): string {
  if (typeof v === 'string') {
    return `"${v.replace(/"/g, '\\"')}"`;
  }
  if (Array.isArray(v)) {
    return `[${v.map((x) => yamlSerialize(x)).join(', ')}]`;
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    return `{ ${entries.map(([k, vv]) => `${k}: ${yamlSerialize(vv)}`).join(', ')} }`;
  }
  return 'null';
}

/**
 * Converte HTML em Markdown usando unified.
 * Opções:
 *  - embedImages: se true, converte <img src> em data:URL usando fetch e base64.
 *  - frontmatter: se presente, prefixa o conteúdo com YAML.
 *  - baseUrl: opcional; se fornecido, torna links/ imagens absolutos.
 */
export async function htmlToMarkdown(
  html: HtmlString | string,
  options: ToMarkdownOptions & { baseUrl?: string } | { embedImages: boolean; frontmatter?: Frontmatter; baseUrl?: string }
): Promise<ToMarkdownResult> {
  const { embedImages, frontmatter, baseUrl } = options;

  const tAll = dtimer('export', 'pipeline total (html→md)');
  dgroup('export', 'htmlToMarkdown: opções', () => {
    console.debug({ embedImages, hasFrontmatter: !!frontmatter, baseUrl });
  });

  // Passo (opcional): embutir imagens **antes** de parsear (mantém src em data:)
  const tPre = dtimer('export', 'pré-processamento de imagens');
  const htmlPreProcessed = embedImages ? await transformImagesToDataUrls(html, baseUrl) : html;
  tPre.end();

  dlog('export', `html length (orig): ${String(html).length}, (pre): ${String(htmlPreProcessed).length}`);

  // Monta a pipeline unified
  const tUnified = dtimer('export', 'unified.process');
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(makeRehypeAbsUrlsPlugin(baseUrl))          // absolutiza href/src/srcset (rehype AST)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(makeRemarkFixCodeLangs())                  // garante .lang quando houver classes
    .use(makeRemarkNormalizeCodeBlocks())
    .use(remarkStringify, stringifyOptions)
    .process(htmlPreProcessed);
  tUnified.end();

  let markdown = String(file) as MarkdownString;

  // Prefixa frontmatter, se houver
  if (frontmatter) {
    dgroup('export', 'frontmatter (yaml)', () => {
      console.debug(buildFrontmatter(frontmatter));
    });
    markdown = (buildFrontmatter(frontmatter) + markdown) as MarkdownString;
  }

  // Garante \n final
  if (!markdown.endsWith('\n')) markdown = (markdown + '\n') as MarkdownString;

  dlog('export', `markdown bytes: ${markdown.length}`);
  tAll.end();
  return { markdown };
}

/** Plugin rehype: absolutiza URLs em <a>, <img>, <source> */
function makeRehypeAbsUrlsPlugin(baseUrl?: string) {
  return function rehypeAbsUrls() {
    return (tree: any) => {
      if (!baseUrl) return;

      const base = new URL(baseUrl);

      visit(tree, (node: any) => {
        if (!node || typeof node !== 'object') return;

        // <a>
        if (node.tagName === 'a' && node.properties?.href) {
          const href = String(node.properties.href);
          if (!isAbsoluteUrl(href)) {
            try {
              node.properties.href = new URL(href, base).toString();
            } catch {}
          }
        }

        // <img>
        if (node.tagName === 'img') {
          if (node.properties?.src) {
            const src = String(node.properties.src);
            if (!isAbsoluteUrl(src)) {
              try {
                node.properties.src = new URL(src, base).toString();
              } catch {}
            }
          }
          if (node.properties?.srcset) {
            node.properties.srcset = normalizeSrcset(String(node.properties.srcset), base);
          }
        }

        // <source>
        if (node.tagName === 'source') {
          if (node.properties?.src) {
            const src = String(node.properties.src);
            if (!isAbsoluteUrl(src)) {
              try {
                node.properties.src = new URL(src, base).toString();
              } catch {}
            }
          }
          if (node.properties?.srcset) {
            node.properties.srcset = normalizeSrcset(String(node.properties.srcset), base);
          }
        }
      });
    };
  };
}

/** Plugin remark: define node.lang quando detectável via classe do HTML original */
function makeRemarkFixCodeLangs() {
  const LANG_ALIASES: Record<string, string> = {
    'shell-session': 'bash',
    'sh-session': 'bash',
    'terminal': 'bash',
  };
  
  // Observação: após rehype→remark, informações de classe podem descer para node.meta
  return function remarkFixCodeLangs() {
    return (tree: any) => {
      visit(tree, 'code', (node: any) => {
        if (!node.lang && typeof node.meta === 'string' && node.meta.length > 0) {
          const m =
            node.meta.match(/language-([A-Za-z0-9+#-]+)/) ||
            node.meta.match(/lang=([A-Za-z0-9+#-]+)/);
          if (m?.[1]) {
            node.lang = m[1].toLowerCase();
            dlog('codes', `lang detectado via meta: ${node.lang}`);
          }
        }

        if (node.lang && LANG_ALIASES[node.lang]) {
          const k = String(node.lang).toLowerCase();
          if (LANG_ALIASES[k]) node.lang = LANG_ALIASES[k];
        }
      });
    };
  };
}

/** Plugin remark: trim + dedent em todos os blocos de código */
function makeRemarkNormalizeCodeBlocks() {
  return function remarkNormalizeCode() {
    return (tree: any) => {
      visit(tree, 'code', (node: any) => {
        if (!node || typeof node.value !== 'string') return;

        // NBSP opcional (ligue com: localStorage.setItem('md.fix.nbsp', '1'))
        let text = node.value.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
        text = text.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
        text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
        text = text.replace("           ", '');

        let lines: string[] = text.split('\n');

        const beforeInfo = {
          lang: node.lang || '(sem lang)',
          nLines: lines.length,
          sample: sampleLines(revealSpaces(text)),
        };

        // trim bordas
        while (lines.length && lines[0].trim() === '') lines.shift();
        while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
        if (lines.length === 0) {
          dgroup('codes', 'code block vazio após trim', () => console.debug(beforeInfo));
          node.value = '';
          return;
        }

        // indent mínimo comum
        let minIndent = 0;
        for (const l of lines) {
          if (l.trim() === '') continue;
          const m = l.match(/^(\s*)/);
          const ind = m ? m[1].length : 0;
          if (minIndent === 0 || ind < minIndent) minIndent = ind;
        }

        if (minIndent > 0) {
          lines = lines.map((line: string) =>
            line.length >= minIndent ? line.slice(minIndent) : line.trimStart()
          );
        }

        const after = lines.join('\n');

        dgroup('codes', `normalize code (${node.lang || 'no-lang'})`, () => {
          console.debug({
            minIndent,
            removedLeading: beforeInfo.nLines - lines.length < 0 ? 0 : undefined,
            before: beforeInfo.sample,
            after: sampleLines(revealSpaces(after)),
          });
        });

        node.value = after;
      });
    };
  };
}


/** Pré-processa HTML, convertendo <img src> → data:URL quando embedImages=true */
async function transformImagesToDataUrls(html: HtmlString | string, baseUrl?: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html as string, 'text/html');
  const imgs = Array.from(doc.images);

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;

      try {
        const abs = baseUrl ? new URL(src, baseUrl).toString() : src;
        const dataUrl = await embedImageAsDataURLIfNeeded(abs, {
          // opções razoáveis para extensões (cookies podem ser necessários)
          credentials: 'include',
          timeoutMs: 9000,
          maxBytes: 6 * 1024 * 1024, // 6MiB
        });
        if (dataUrl) {
          dlog('images', `embedded: ${abs} → data:${dataUrl.slice(5, 20)}…`);
          img.setAttribute('src', dataUrl);
        } else {
          dlog('images', `kept url: ${abs} (sem embed)`);
        }
      } catch {
        // mantém URL original se falhar
      }
    }),
  );

  return doc.body.innerHTML;
}
