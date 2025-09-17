import type { IParser, ParserName, IParserRegistry, ParserResolution } from '~/types';
import { GenericParser } from './generic/generic-parser';
import { MediumParser } from './specific/medium-parser';
import { GithubReadmeParser } from './specific/github-parser';

type Score = number;

export class ParserRegistry implements IParserRegistry {
  private parsers: IParser[] = [];
  private generic = new GenericParser();

  constructor() {
    this.register(new MediumParser());
    this.register(new GithubReadmeParser());
  }

  register(parser: IParser): void {
    // evita duplicatas por name
    const i = this.parsers.findIndex((p) => p.name === parser.name);
    if (i >= 0) this.parsers[i] = parser;
    else this.parsers.push(parser);
  }

  list(): IParser[] {
    return [...this.parsers];
  }

  resolve(url: string, doc: Document, forced: ParserName | 'auto' = 'auto'): ParserResolution {
    // 1) Forçado pelo usuário
    if (forced && forced !== 'auto') {
      const chosen = [...this.parsers, this.generic].find((x) => x.name === forced);
      const selected = chosen ?? this.generic;
      const reason = chosen
        ? `forced=${forced}`
        : `forced=${forced} (not found) → fallback=generic`;
      const candidates = this.buildCandidates(url, doc, selected);
      this.debugLog(url, { reason, selected: selected.name, candidates });
      return { selected, candidates, reason };
    }

    // 2) Auto: pontuar candidatos
    const scored: Array<{ parser: IParser; score: Score }> = [];

    for (const p of this.parsers) {
      if (!safeMatch(p, url, doc)) continue;
      const s = scoreByDomainPatterns(p, url);
      scored.push({ parser: p, score: s });
    }

    // sempre adiciona o genérico como opção de fallback
    scored.push({ parser: this.generic, score: 1 });

    // ordena por score desc (empate: ordem de registro)
    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0]?.parser ?? this.generic;
    const candidates = scored.map((c) => ({ name: c.parser.name, score: c.score }));
    const reason =
      selected === this.generic && candidates.length > 1
        ? 'no specific parser outranked generic'
        : `matched by domain scoring (${selected.name})`;

    this.debugLog(url, { reason, selected: selected.name, candidates });
    return { selected, candidates, reason };
  }

  private buildCandidates(url: string, doc: Document, selected: IParser) {
    const cand = this.parsers
      .filter((p) => safeMatch(p, url, doc))
      .map((p) => ({ name: p.name, score: scoreByDomainPatterns(p, url) }));
    // inclui generic
    cand.push({ name: this.generic.name, score: selected === this.generic ? 2 : 1 });
    // ordena desc
    cand.sort((a, b) => b.score - a.score);
    return cand;
  }

  private debugLog(url: string, data: unknown) {
    // habilite via: localStorage.setItem('md.debug.parsers', '1')
    try {
      if (localStorage.getItem('md.debug.parsers') === '1') {
        // eslint-disable-next-line no-console
        console.debug('[ParserRegistry]', { url, ...(Object(data)) });
      }
    } catch {
      /* ignore cross-origin/localStorage access issues */
    }
  }
}


/* ------------------- Scoring helpers ------------------- */

/** Garante que `match` não estoure exceção e só retorna boolean. */
function safeMatch(p: IParser, url: string, doc: Document): boolean {
  try {
    return !!p.match(url, doc);
  } catch {
    return false;
  }
}

/**
 * Score baseado nos padrões declarados do parser.
 * Heurística:
 *  - match exato do host em `pattern` (sem curingas)       = 60
 *  - wildcard `*.exemplo.com` (sufixo de host)             = 50
 *  - regex `/.../` que dê match                            = 40
 *  - sem domains (mas match() retornou true)               = 20
 *  + priority opcional por pattern (somada ao base score)
 */
function scoreByDomainPatterns(p: IParser, urlStr: string): number {
  let best = 0;
  if (!p.domains || p.domains.length === 0) {
    return 20;
  }
  let host = '';
  try {
    host = new URL(urlStr).hostname;
  } catch {
    /* ignore */
  }
  for (const pat of p.domains) {
    const { score } = matchPattern(host, urlStr, pat.pattern);
    if (score > 0) {
      // soma prioridade se existir
      const withPriority = score + (pat.priority ?? 0);
      if (withPriority > best) best = withPriority;
    }
  }
  return best || 20;
}

/** Retorna {score} maior para match mais específico */
function matchPattern(host: string, urlStr: string, pattern: string): { score: number } {
  if (!pattern) return { score: 0 };

  // Regex literal: /.../
  if (pattern.length >= 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      const rx = new RegExp(pattern.slice(1, -1));
      return rx.test(urlStr) ? { score: 40 } : { score: 0 };
    } catch {
      return { score: 0 };
    }
  }

  // Wildcard: *.exemplo.com
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".exemplo.com"
    return host.endsWith(suffix) ? { score: 50 } : { score: 0 };
  }

  // Exato / sufixo simples (ex.: "medium.com" cobre subdomínios?)
  if (host === pattern) return { score: 60 };
  // também consideramos sufixo direto como <= wildcard
  if (host.endsWith('.' + pattern)) return { score: 45 };

  return { score: 0 };
}