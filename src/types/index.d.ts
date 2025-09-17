/* src/types.ts
  * Tipos centrais do projeto: domínio de parsing, pipeline HTML→Markdown,
  * UI/Options, mensageria MV3, políticas de assets e resultados.
  */

/* 
  *=========================================
  * Utilitários base / branded primitives
  * ========================================= 
  */

export type Brand<T, B extends string> = T & { __brand: B };

export type URLString = Brand<string, 'URLString'>;
export type HtmlString = Brand<string, 'HtmlString'>;
export type MarkdownString = Brand<string, "MarkdownString">;
export type DataUrlString = Brand<string, 'DataUrlString'>;
export type FileName = Brand<string, 'FileName'>;
export type ISODate = Brand<string, 'ISODate'>;

export type NonEmptyArray<T> = [T, ...T[]];
export type Nullable<T> = T | null | undefined;
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type ParserName = 
  | 'auto'
  | 'generic'
  | 'medium'
  | 'github-readme'
  | (string & {});

export type ParseId = Brand<string, 'ParserId'>;

export interface DomainPattern {
  pattern: string;
  priority?: number;
}

/*
  * =========================================
  * Opções (UI/Storage/Runtime) e políticas
  * ========================================= 
  */

export type AssetInliningPolicy = 'embed-base64' | 'keep-url' | 'download-rewrite';

export interface ExportOptions {
  embedImages: boolean;
  includeMetadata: boolean;
  parser: ParserName | 'auto';
  assetsPolicy?: AssetInliningPolicy;
  normalizations?: {
    trimTitle?: boolean;
    collapseWhitespace?: boolean;
  };
}

export interface ResolvedExportOptions extends ExportOptions {
  resolvedAt: ISODate;
}

/* 
  * =========================================
  * Frontmatter e Metadados
  * ========================================= 
  */

export interface Frontmatter {
  title?: string;
  source_url?: string;
  date?: ISODate;
  tags?: string[];
  [k: string]: unknown;
}

/*
  * =========================================
  * Modelo de Conteúdo (AST normalizado)
  * - Independente de HTML/Markdown para facilitar testes e parsers específicos
  * - Pode ser derivado de HTML (via DOM/Readability) e virar Markdown depois
  * ========================================= 
 */

export interface Position {
  start?: { line?: number; column?: number; offset?: number; };
  end?: { line?: number; column?: number; offset?: number; };
}

export interface BaseNode {
  type: string;
  position?: Position;
}


export interface TextNode extends BaseNode {
  type: 'text';
  value: string;
}

export interface EmphasisNode extends BaseNode {
  type: 'emphasis';
  children: InlineNode[];
}

export interface StrongNode extends BaseNode {
  type: 'strong';
  children: InlineNode[];
}

export interface InlineCodeNode extends BaseNode {
  type: 'inlineCode';
  value: string;
}

export interface LinkNode extends BaseNode {
  type: 'link';
  url: URLString | string;
  title?: string;
  children: InlineNode[];
}

export interface ImageNode extends BaseNode {
  type: 'image';
  alt?: string;
  title?: string;
  src: URLString | DataUrlString | string;
  meta?: Partial<ImageAsset>;
}

export type InlineNode =
  | TextNode
  | EmphasisNode
  | StrongNode
  | InlineCodeNode
  | LinkNode
  | ImageNode;

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  children: InlineNode[];
}

export interface HeadingNode extends BaseNode {
  type: 'heading';
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

export interface ListItemNode extends BaseNode {
  type: 'listItem';
  checked?: boolean;
  children: BlockNode[];
}

export interface ListNode extends BaseNode {
  type: 'list';
  ordered: boolean;
  start?: number;
  spread?: boolean;
  children: ListItemNode[];
}

export interface CodeBlockNode extends BaseNode {
  type: 'code';
  lang?: string;
  meta?: string;
  value: string;
}

export interface BlockquoteNode extends BaseNode {
  type: 'blockquote';
  children: BlockNode[];
}

export interface ThematicBreakNode extends BaseNode {
  type: 'thematicBreak';
}

export interface TableCellNode extends BaseNode {
  type: 'tableCell';
  children: InlineNode[];
}

export interface TableRowNode extends BaseNode {
  type: 'tableRow';
  children: TableCellNode[];
}

export interface TableNode extends BaseNode {
  type: 'table';
  align?: Array<'left' | 'center' | 'right' | null>;
  children: TableRowNode[];
}

export interface HtmlNode extends BaseNode {
  type: 'html';
  value: HtmlString | string;
}

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | ListNode
  | CodeBlockNode
  | BlockquoteNode
  | ThematicBreakNode
  | TableNode
  | HtmlNode;

export interface ContentRoot extends BaseNode {
  type: 'root';
  children: BlockNode[];
}

/* 
  * =========================================
  * Assets (imagens e futuros arquivos)
  * ========================================= 
  */

export interface ImageAsset {
  src: URLString | DataUrlString | string;
  contentType?: string; // mime-type
  bytes?: number;
  dataUrl?: DataUrlString;
  /** usado quando baixarmos assets e reescrevermos paths (roadmap) */
  fileName?: FileName;
  /** título/alt resolvidos */
  alt?: string;
  title?: string;
  /** campo extensível */
  [k: string]: unknown;
}

/*
  * =========================================
  * Resultado de extração/conversão
  * ========================================= 
  */

export interface ExtractResult {
  title?: string;
  /** HTML principal extraído do DOM */
  contentHtml: HtmlString | string;
  /** Modelo normalizado (opcional, para parsers específicos) */
  contentAst?: ContentRoot;
  /** Assets detectados durante a extração */
  assets?: {
    images?: ImageAsset[];
  };
}

export interface ToMarkdownOptions {
  embedImages: boolean;
  /** permite passar frontmatter já resolvido para prefixo */
  frontmatter?: Frontmatter;
}

export interface ToMarkdownResult {
  markdown: MarkdownString | string;
  /** assets finais (se aplicável) */
  assets?: {
    images?: ImageAsset[];
  };
}

/*
  * =========================================
  * Contratos de Parser e Pipeline
  * ========================================= 
  */

export interface ParserCapabilities {
  /** Parser extrai AST normalizado (além do HTML) */
  outputsAst?: boolean;
  /** Parser já normaliza code blocks com linguagem */
  codeLangAware?: boolean;
  /** Parser pode reescrever imagens (ex.: proxificar/normalizar) */
  imageRewriter?: boolean;
}

export interface ParserContext {
  /** URL da página atual */
  url: URLString | string;
  /** Documento da aba (content script) */
  document: Document;
  /** Opções resolvidas para esta execução */
  options: ResolvedExportOptions;
}

export interface IParser {
  /** Nome único do parser (ex.: 'medium') */
  name: ParserName;
  /** Padrões (hosts/regex) que este parser cobre (apenas informativo) */
  domains?: DomainPattern[];

  /** Retorna true se este parser deve processar a URL */
  match: (url: string, document: Document) => boolean;

  /**
   * Extração do conteúdo principal
   * - Deve retornar HTML “limpo” do artigo/README/… e opcionalmente AST e assets.
   */
  extract: (document: Document, ctx?: ParserContext) => Promise<ExtractResult>;

  /**
   * Conversão para Markdown
   * - Recebe HTML ou AST; parsers simples delegam para a função comum (unified).
   */
  toMarkdown: (input: HtmlString | string | ContentRoot, options: ToMarkdownOptions) => Promise<ToMarkdownResult>;
  
  /** Capacidades declaradas do parser (para telemetria futura e decisions) */
  capabilities?: ParserCapabilities;
}

/** Resultado de resolução/seleção do parser */
export interface ParserResolution {
  selected: IParser;
  /** lista de candidatos que deram match (para debug/diagnóstico) */
  candidates: Array<{ name: ParserName; score: number }>;
  reason?: string;
}

/** Contrato do Registry */
export interface IParserRegistry {
  register: (parser: IParser) => void;
  list: () => IParser[];
  resolve: (url: string, doc: Document, forced?: ParserName | 'auto') => ParserResolution;
}

/*
  * =========================================
  * Mensageria MV3 (BG ⇄ CS ⇄ UI)
  * ========================================= 
  */

export type BgToCsMessage =
  | { type: 'EXPORT_MARKDOWN' };

export type CsToBgResponse =
  | { ok: true; filename: FileName | string; markdown: MarkdownString | string }
  | { ok: false; error: ExportFailure };

export type UiToBgMessage =
  | { type: 'EXPORT_NOW' };

export type BgAck =
  | { ok: true }
  | { ok: false; error: string };

/*
  * =========================================
  * Erros e falhas de exportação
  * ========================================= 
  */

export type FailureReason =
  | 'parser-not-found'
  | 'extraction-failed'
  | 'conversion-failed'
  | 'download-failed'
  | 'permission-denied'
  | 'unknown';

export interface ExportFailure {
  reason: FailureReason;
  message?: string;
  causa?: unknown; // intentionally Portuguese-friendly key accepted
}

/*
  * =========================================
  * Storage schema (chrome.storage.sync/local)
  * ========================================= 
  */

export interface StorageSchema {
  embedImages: boolean;
  includeMetadata: boolean;
  parser: ParserName | 'auto';
  assetsPolicy?: AssetInliningPolicy;
  normalizations?: ExportOptions['normalizations'];
}

/*
  * =========================================
  * Resultado final de uma exportação (p/ logs e testes)
  * ========================================= 
  */

export interface ExportResultOk {
  ok: true;
  parser: ParserName;
  title?: string;
  frontmatter?: Frontmatter;
  markdown: MarkdownString | string;
  filename: FileName | string;
  assets?: {
    images?: ImageAsset[];
  };
}

export interface ExportResultErr {
  ok: false;
  error: ExportFailure;
}

export type ExportResult = ExportResultOk | ExportResultErr;

/*
  * =========================================
  * Helpers de type guards
  * ========================================= 
  */

export function isExportOk(x: ExportResult): x is ExportResultOk {
  return (x as ExportResultOk).ok === true;
}

export function isDataUrl(src: string): src is DataUrlString {
  return src.startsWith('data:') as boolean;
}

/*
  * =========================================
  * Convenções: nomes de comandos/menus
  * ========================================= 
  */

export const COMMANDS = {
  EXPORT_MARKDOWN: 'export_markdown',
} as const;

export const CONTEXT_MENU_IDS = {
  EXPORT_MD: 'export-md',
} as const;

/*
  * =========================================
  * Parser Spec (guia do dev)
  * ========================================= 
  */

export interface ParserSpecDoc {
  name: ParserName;
  description?: string;
  patterns: DomainPattern[];
  examples?: URLString[];
  notes?: string[];
}