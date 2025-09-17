# Milestones

* **v1.1 – UX & Estabilidade**
* **v1.2 – Parsers & Qualidade do MD**
* **v1.3 – Assets & Performance**
* **v1.4 – Internacionalização & Publicação**
* **v1.5 – Enriquecimento de Metadados**
---

# Épico 1: UX & Estabilidade (Milestone v1.1)

### Issue: Statusbar estável no Popup e Options

**Descrição**

* Manter altura estável e transição só de opacidade.
* Usar `.ui-statusbar` com `min-height`, `data-show` e tokens de cor do tema.

**Critérios de aceite**

* Sem “pula-pula” ao trocar mensagens.
* Leitor de tela anuncia mudanças (aria-live).
* Dark/Light com contraste AA.

**Tarefas**

* [ ] Aplicar `.ui-statusbar` no popup e options.
* [ ] Garantir `aria-live="polite" aria-atomic="true"`.
* [ ] Testar com mensagens longas (ellipsis).

**Prioridade** P0 • **Estimativa** 2 pts • **Labels** `ui`, `accessibility`

---

### Issue: Botão “Copiar .md” no Popup

**Descrição**

* Ação alternativa ao download para copiar o markdown.

**Critérios de aceite**

* Ao clicar, copia o conteúdo convertido.
* Feedback “Copiado ✓” na statusbar.
* Fallback com erro amigável.

**Tarefas**

* [ ] BG: adicionar handler `EXPORT_NOW_INLINE`.
* [ ] Popup: botão “Copiar .md” + estado.
* [ ] Tratamento de erro clipboard desabilitado.

**Prioridade** P1 • **Estimativa** 3 pts • **Labels** `feature`, `popup`

---

### Issue: Exportar apenas a seleção via Context Menu

**Descrição**

* Se usuário selecionar texto e clicar no menu, exportar só esse trecho.

**Critérios de aceite**

* Quando houver seleção, arquivo recebe sufixo “(seleção)”.
* Sem seleção: comportamento atual.

**Tarefas**

* [ ] BG: encaminhar `selectionText` ao CS.
* [ ] CS: branch de extração baseada em `selection`.
* [ ] Sanitização básica do HTML de seleção.

**Prioridade** P1 • **Estimativa** 3 pts • **Labels** `feature`, `content-script`

---

### Issue: Mensagens de erro específicas

**Descrição**

* Diferenciar causas (injeção bloqueada, permissões, falha de download).

**Critérios de aceite**

* Logs no BG com código da causa.
* Statusbar mostra mensagem humana e curta.

**Tarefas**

* [ ] Mapear exceções → `FailureReason`.
* [ ] Mensagens localizadas (placeholder).
* [ ] Telemetria de console guardada atrás de flag (`md.debug.export`).

**Prioridade** P1 • **Estimativa** 2 pts • **Labels** `dx`, `error-handling`

---

# Épico 2: Parsers & Qualidade (Milestone v1.2)

### Issue: Parser dev.to

**Descrição**

* Suporte a posts dev.to, mantendo títulos, imagens e code blocks.

**Critérios de aceite**

* README/Artigo converte sem sobras de sidebar/nav.
* Links e imagens absolutizados.

**Tarefas**

* [ ] `DevToParser` com `domains: dev.to`.
* [ ] Limpeza de `aside/nav/footer`.
* [ ] Testes manuais em 3 URLs.

**Prioridade** P2 • **Estimativa** 3 pts • **Labels** `parser`

---

### Issue: Melhorar detecção de linguagem em code blocks

**Descrição**

* Inferir `lang` a partir de `class="language-..."` e `code[data-lang]`.

**Critérios de aceite**

* ≥90% dos blocos com linguagem correta em Medium/GitHub/dev.to.

**Tarefas**

* [ ] Plugin remark/rehype: leitura de classes antes de remark.
* [ ] Testar com TS, JSON, diff.

**Prioridade** P2 • **Estimativa** 2 pts • **Labels** `markdown`, `parser`

---

### Issue: Normalizações (trimTitle, collapseWhitespace)

**Descrição**

* Implementar flags em `ExportOptions.normalizations`.

**Critérios de aceite**

* Título sem espaços nas pontas.
* Colapsar whitespaces múltiplos em parágrafos.

**Tarefas**

* [ ] Aplicar normalizações antes do pipeline.
* [ ] Toggle no Options (opcional).

**Prioridade** P3 • **Estimativa** 2 pts • **Labels** `quality`

---

# Épico 3: Assets & Performance (Milestone v1.3)

### Issue: Expor política de assets (embed/keep-url)

**Descrição**

* UI para `assetsPolicy`: `embed-base64` | `keep-url`.

**Critérios de aceite**

* “Embed imagens” desabilitado quando `keep-url`.
* Persistência em `chrome.storage.sync`.

**Tarefas**

* [ ] Atualizar tipos e leitura no CS.
* [ ] Campo `select` nas Options.
* [ ] Documentar no README.

**Prioridade** P2 • **Estimativa** 2 pts • **Labels** `feature`, `options`

---

### Issue: Limite configurável para embutir imagens (MiB)

**Descrição**

* Input numérico ou slider (1–10 MiB) que alimenta `maxBytes`.

**Critérios de aceite**

* Imagens maiores que o limite não são embutidas.
* Statusbar informa quando imagens foram mantidas por tamanho.

**Tarefas**

* [ ] Options: controle + validação.
* [ ] CS: passar para `embedImageAsDataURLIfNeeded`.

**Prioridade** P2 • **Estimativa** 2 pts • **Labels** `performance`, `options`

---

### Issue: Cache LRU de data URLs (limite de memória)

**Descrição**

* Substituir `Map` por LRU com limite de itens/bytes.

**Critérios de aceite**

* Sem leaks perceptíveis em páginas longas.
* Evitar re-fetch para mesma URL na sessão.

**Tarefas**

* [ ] Implementar LRU simples (capacidade 50–100 ou \~30MB).
* [ ] Métrica de acertos (atrás de flag debug).

**Prioridade** P3 • **Estimativa** 3 pts • **Labels** `performance`

---

# Épico 4: Internacionalização & Publicação (Milestone v1.4)

### Issue: i18n (pt-BR/en)

**Descrição**

* Externalizar strings para `_locales`.

**Critérios de aceite**

* Popup/Options mudam com o locale do navegador.
* Fallback para inglês.

**Tarefas**

* [ ] `_locales/en/messages.json`, `_locales/pt_BR/messages.json`.
* [ ] Substituir strings por `browser.i18n.getMessage`.

**Prioridade** P2 • **Estimativa** 3 pts • **Labels** `i18n`

---

### Issue: Reduzir permissões

**Descrição**

* Minimizar `host_permissions` (preferir `activeTab`).

**Critérios de aceite**

* Extensão funciona sem `<all_urls>`.
* Revisão de loja sem alerta crítico.

**Tarefas**

* [ ] Trocar `<all_urls>` por `activeTab`.
* [ ] Testar export em diferentes domínios.

**Prioridade** P2 • **Estimativa** 2 pts • **Labels** `security`

---

## Tarefas de Infra/DevX

### Issue: Flag de debug unificada

**Descrição**

* `md.debug.parsers` e `md.debug.export` (tempos e etapas).

**Critérios de aceite**

* `console.debug` somente quando a flag=1.
* Logs com tempos (ms) por etapa.

**Tarefas**

* [ ] Helper `debug(name, ...args)` que checa localStorage.
* [ ] Medir: extract, toMarkdown, download.

**Prioridade** P3 • **Estimativa** 1 pt • **Labels** `dx`

---

# Épico 5: Enriquecimento de Metadados (Milestone v1.2/v1.3)

### Issue: Classificador de conteúdo → tags/frontmatter

**Descrição**
Implementar um classificador (heurístico inicialmente, IA opcional depois) que sugere ou preenche tags no **frontmatter** (e eventualmente outros metadados úteis, como categoria ou nível técnico).

**Critérios de aceite**

* Exportação gera `tags: [...]` no YAML quando possível.
* Mínimo: heurística baseada em palavras-chave / headings.
* Opcional: integração com modelo IA (local ou API).
* Deve ser opcional (toggle nas opções).
* Sem travar exportação em caso de falha — apenas ignora.

**Tarefas**

* [ ] Definir interface `MetadataEnricher` (input: `ExtractResult`, output: `{tags?: string[]; …}`).
* [ ] Implementar heurística simples (ex.: detectar “JavaScript”, “React”, “AI”, “Medium” em headings/texto).
* [ ] Pipeline no `exportCurrentPage` aplica enriquecedor antes do `toMarkdown`.
* [ ] Opção nas **Options**: “Gerar tags automáticas”.
* [ ] UI: tooltip explicando que pode gerar resultados imperfeitos.
* [ ] (Futuro) Suporte a IA (ex.: chamada opcional para API local/externa).

**Prioridade** P2
**Estimativa** 5 pts (2 heurística + 3 integração UI)
**Labels** `feature`, `metadata`, `parser`

# Ordem sugerida de entrega

1. Statusbar estável (P0)
2. Copiar .md (P1)
3. Exportar seleção (P1)
4. Erros específicos (P1)
5. Parser dev.to (P2)
6. Detecção de linguagem (P2)
7. Assets policy + limite de MiB (P2)
8. i18n (P2)
9. Reduzir permissões (P2)
10. LRU cache & normalizações (P3)
11. Flag de debug (P3)

---

# Sugestão de branches/commits

* `feat/statusbar-stable`
* `feat/clipboard-copy`
* `feat/export-selection`
* `impr/error-messages`
* `feat/parser-devto`
* `impr/code-lang-detection`
* `feat/assets-policy`
* `feat/embed-max-mib`
* `feat/i18n`
* `chore/permissions-min`
* `perf/lru-image-cache`
* `impr/normalizations`
* `chore/debug-flags`
* `feat/metadata-classifier`

Mensagens de commit (modelo):

* `feat(popup): adicionar botão 'Copiar .md' com feedback na statusbar`
* `fix(options): statusbar com altura estável e aria-live`
* `feat(bg,cs): exportar seleção via context menu`
* `impr(errors): mensagens específicas para injeção/perm/download`
* `feat(metadata): classificador heurístico para gerar tags no frontmatter`
