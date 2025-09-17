# MarkClip

> Exporte qualquer página da web para **Markdown (.md)** — com imagens (opcionalmente embutidas em base64), frontmatter e parsers específicos por domínio.

* **Atalho rápido**: `Ctrl/Cmd + Shift + M`
* **Parsers**: Genérico, Medium, GitHub README (com prioridade por domínio)
* **Imagens**: opcionalmente embutidas (`data:`) com limites e timeout
* **Frontmatter**: título, data ISO, `source_url` e (roadmap) **tags** automáticas
* **Opções**: escolha de parser (Auto/Genérico/Medium/GitHub), incluir metadata, embutir imagens
* **A11y**: statusbar com `aria-live` e altura estável

## Sumário

- [MarkClip](#markclip)
  - [Sumário](#sumário)
  - [Instalação (Dev)](#instalação-dev)
  - [Como usar](#como-usar)
  - [Permissões](#permissões)
  - [Arquitetura](#arquitetura)
  - [Parsers](#parsers)
    - [Adicionando um novo parser](#adicionando-um-novo-parser)
  - [Imagens (embed base64)](#imagens-embed-base64)
  - [Frontmatter](#frontmatter)
  - [Configurações](#configurações)
  - [Roadmap / Backlog](#roadmap--backlog)
  - [Privacidade](#privacidade)
  - [Troubleshooting](#troubleshooting)
  - [Contribuindo](#contribuindo)
    - [Estrutura de pastas (essencial)](#estrutura-de-pastas-essencial)
  - [Licença](#licença)

## Instalação (Dev)

Este projeto usa **[WXT](https://wxt.dev/)** + React.

```bash
# 1) Instale dependências
pnpm i     # ou npm i / yarn

# 2) Rodar em modo desenvolvimento
pnpm dev   # abre página com instruções para carregar a extensão não empacotada

# 3) Build de produção
pnpm build # gera pasta dist/ para empacotar/publicar
```

**Carregar no Chrome (unpacked)**

1. Acesse `chrome://extensions`
2. Ative **Developer mode**
3. **Load unpacked** → selecione a pasta `dist/`

## Como usar

* Clique no ícone da extensão ou use o atalho **`Ctrl/Cmd + Shift + M`**.
* Na popup, ajuste:

  * **Embeder imagens (base64)**
  * **Incluir metadata (frontmatter)**
  * **Parser** (Auto, Genérico, Medium, GitHub README)
* Clique em **Exportar agora** → inicia **download** de um `.md`.

Dica: você também pode abrir **Opções** para definir os padrões.

## Permissões

* `activeTab`, `scripting`, `downloads`, `storage`, `contextMenus`
* `host_permissions`: atualmente `<all_urls>` (há item de backlog para reduzir para `activeTab` apenas).

> Objetivo: aprovar em loja com o mínimo de permissões (ver [Roadmap](#roadmap--backlog)).

## Arquitetura

* **Background (MV3)**: coordena injeção de content script, recebe comandos (atalho/menus), dispara download.
* **Content Script**: resolve o parser, extrai conteúdo, converte HTML → Markdown.
* **Popup / Options (React)**: UI para exportar e configurar preferências.
* **Libs**:

  * `lib/markdown.ts`: pipeline **rehype → remark** (GFM, stringify seguro, absolutização de URLs, fix de lang em code blocks).
  * `lib/images.ts`: embed de imagens (timeout, limite de bytes, cache simples).
  * `lib/dom.ts`: seleção/limpeza de container, absolutização de URLs `href/src/srcset`.

**Fluxo**
`Popup → Background → Content Script → (Parser) extract → markdown → Background download`

## Parsers

* **Genérico**: tenta `Readability` e/ou heurística `main/article` → `body`
* **Medium**: remove navegação/aside/footers e extrai `article`
* **GitHub README**: pega `#readme article` (ou fallback)

A resolução usa `ParserRegistry`:

* **Auto** → pontua por domínio (`medium.com`, `github.com`, wildcard, regex etc.)
* **Forçado** (Options/Popup) → usa parser escolhido; fallback é o genérico.

### Adicionando um novo parser

Crie em `src/entrypoints/content/parsers/specific/<nome>-parser.ts`:

```ts
export class DevToParser implements IParser {
  name = 'devto' as const;
  domains = [{ pattern: 'dev.to', priority: 4 }];

  match(url: string) { return new URL(url).hostname === 'dev.to'; }

  async extract(document: Document) {
    const root = document.querySelector('article') ?? document.body;
    // ...limpezas específicas...
    return { title: document.title, contentHtml: root.innerHTML as any };
  }

  async toMarkdown(input, options) {
    return htmlToMarkdown(typeof input === 'string' ? input : '' as any, options);
  }
}
```

E registre em `parsers/index.ts` com `this.register(new DevToParser());`.

## Imagens (embed base64)

* Ao ativar **Embeder imagens**, cada `<img src>` tenta virar `data:image/...;base64,...`
* Controles internos:

  * Timeout de fetch (AbortController)
  * Tamanho máximo por imagem (MiB)
  * Regex de MIME permitido
* Se falhar (timeout/limite/MIME), mantém a URL original.

> Backlog inclui **política de assets** e **limite configurável em MiB**.

## Frontmatter

Quando **Incluir metadata** estiver ligado, o Markdown é prefixado por um YAML simples:

```yaml
---
title: "Meu título"
source_url: "https://exemplo.com/post"
date: "2025-09-17"
# (futuro) tags: ["javascript", "react", "tutorial"]
---
```

> O título tenta vir do `<h1>`; fallback para `document.title`.

## Configurações

Acesse **Opções** para definir os padrões:

* **Embeder imagens (base64)**
* **Incluir metadata (frontmatter)**
* **Parser padrão**: Auto / Genérico / Medium / GitHub README

Essas preferências sincronizam via `chrome.storage.sync`.
A UI traz **statusbar** com altura estável e `aria-live` para feedbacks (“Preferências salvas ✓”, “Carregando…” etc).

## Roadmap / Backlog

O repositório inclui [`backlog.md`](./backlog.md) com milestones e issues — destaque:

* **v1.1 – UX & Estabilidade**

  * Statusbar estável ✔
  * Botão **Copiar .md**
  * Exportar **apenas seleção** via context menu
  * Mensagens de erro específicas
* **v1.2 – Parsers & Qualidade**

  * Parser **dev.to**
  * Melhorar detecção de linguagem em code blocks
* **v1.3 – Assets & Performance**

  * Política de assets (embed/keep-url)
  * Limite configurável (MiB) para embed
  * Cache **LRU** para data URLs
* **v1.4 – i18n & Publicação**

  * Localização `pt-BR`/`en`
  * Reduzir permissões para aprovação em loja
* **v1.5 – Enriquecimento de Metadados**

  * **Classificador** (Heurística/IA) para preencher `tags`/categoria

    * Interface `MetadataEnricher`
    * Toggle nas opções
    * Sem bloquear a exportação em caso de falha

## Privacidade

* Todo o processamento ocorre **localmente** no seu navegador.
* Sem telemetria.
* Downloads são gerados via `data:` URL e API `chrome.downloads`.

> Se, no futuro, você ativar a **opção de IA** (backlog), a chamada será **opt-in** e documentada.

## Troubleshooting

* **Nada acontece ao exportar**
  Alguns sites/URLs (ex.: `chrome://`, Web Store, PDFs embutidos) bloqueiam injeção de scripts.
  Tente em outra página. Verifique o Console da extensão (Background) para mensagens de injeção.

* **Markdown sem imagens embutidas**
  Imagem pode exceder o limite ou bloquear fetch por CORS/auth. O pipeline mantém a URL original.

* **Título estranho**
  Use a opção “Incluir metadata (frontmatter)” e edite o `title` depois se necessário. (Backlog prevê normalizações de título.)

## Contribuindo

1. Crie uma branch: `feat/minha-ideia`
2. Siga o guideline de commits (exemplos no `backlog.md`)
3. Faça PR descrevendo o cenário e URLs de teste

### Estrutura de pastas (essencial)

```
src/
  entrypoints/
    background/
    content/
      parsers/
        generic/
        specific/
    options/
    popup/
  lib/
    dom.ts
    images.ts
    markdown.ts
types/
wxt.config.ts
```

## Licença

Veja o arquivo [`LICENSE`](/LICENSE) 
