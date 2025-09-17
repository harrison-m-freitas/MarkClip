import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExportOptions, ParserName } from '~/types';

const DEFAULTS: ExportOptions = {
  embedImages: false,
  includeMetadata: true,
  parser: 'auto',
};

const PARSER_OPTIONS: Array<{ value: ExportOptions['parser']; label: string}> = [
  { value: 'auto',          label: 'Auto (recomendado)' },
  { value: 'generic',       label: 'Genérico' },
  { value: 'medium',        label: 'Medium' },
  { value: 'github-readme', label: 'GitHub README' },
];

const SAVE_DEBOUNCE_MS = 250;

export default function Options() {
  const [opts, setOpts] = useState<ExportOptions>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await chrome.storage.sync.get(['embedImages', 'includeMetadata', 'parser']);
        if (!mounted) return;
        setOpts({
          embedImages: r.embedImages ?? DEFAULTS.embedImages,
          includeMetadata: r.includeMetadata ?? DEFAULTS.includeMetadata,
          parser: (r.parser as ParserName | undefined) ?? DEFAULTS.parser,
        });
        setIsLoading(false);
      } catch {
        setErrorMsg('Falha ao carregar opções.');
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'sync') return;
      const next = { ...opts };
      let changed = false;

      if ('embedImages' in changes && typeof changes.embedImages.newValue === 'boolean') {
        next.embedImages = changes.embedImages.newValue;
        changed = true;
      }
      if ('includeMetadata' in changes && typeof changes.includeMetadata.newValue === 'boolean') {
        next.includeMetadata = changes.includeMetadata.newValue;
        changed = true;
      }
      if ('parser' in changes && typeof changes.parser.newValue !== 'undefined') {
        next.parser = changes.parser.newValue;
        changed = true;
      }
      if (changed) setOpts(next);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [opts]);

  function scheduleSave(next: ExportOptions) {
    setOpts(next);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await chrome.storage.sync.set(next);
        setJustSaved(true);
        window.setTimeout(() => setJustSaved(false), 1100);
      } catch {
        setErrorMsg('Falha ao salvar alterações.');
      }
    }, SAVE_DEBOUNCE_MS) as unknown as number;
  }

  function onToggle<K extends keyof ExportOptions>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      scheduleSave({ ...opts, [key]: e.target.checked } as ExportOptions);
  }

  function onParserChange(e: React.ChangeEvent<HTMLSelectElement>) {
    scheduleSave({ ...opts, parser: e.target.value as ExportOptions['parser'] });
  }

  async function resetToDefaults() {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    try {
      await chrome.storage.sync.set(DEFAULTS);
      setOpts(DEFAULTS);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1100);
    } catch {
      setErrorMsg('Não foi possível resetar para o padrão.');
    }
  }

  const status = useMemo(() => {
    if (isLoading) return { text: 'Carregando…', tone: 'muted' as const };
    if (errorMsg) return { text: errorMsg, tone: 'danger' as const };
    if (justSaved) return { text: 'Preferências salvas ✓', tone: 'success' as const };
    return { text: '', tone: 'muted' as const };
  }, [isLoading, errorMsg, justSaved]);

  const embedId = 'opt-embed';
  const fmId = 'opt-frontmatter';
  const parserId = 'opt-parser';

  return (
    <div className="ui-surface ui-surface--page p-6">
      <header className="mb-4">
        <h1 className="ui-title">Opções — MarkClip</h1>
        <p className="ui-subtitle">Defina o comportamento padrão de exportação.</p>
        <div
          className={`ui-statusbar ui-statusbar--${status.tone}`}
          data-show={Boolean(status.text)}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {status.text || '\u00A0'}
        </div>
      </header>

      <fieldset className="ui-fieldset" disabled={isLoading}>
        <legend className="sr-only">Preferências</legend>

        <label htmlFor={embedId} className="ui-switch">
          <input id={embedId} type="checkbox" checked={opts.embedImages} onChange={onToggle('embedImages')} />
          <span className="ui-switch__label">Embeder imagens (base64)</span>
        </label>
        <p className="ui-help">
          Útil para garantir portabilidade do Markdown, mas pode aumentar bastante o tamanho do arquivo.
        </p>

        <label htmlFor={fmId} className="ui-switch">
          <input id={fmId} type="checkbox" checked={opts.includeMetadata} onChange={onToggle('includeMetadata')} />
          <span className="ui-switch__label">Incluir metadata (frontmatter)</span>
        </label>

        <label htmlFor={parserId} className="ui-label">
          Parser padrão
          <select id={parserId} className="ui-select" value={opts.parser} onChange={onParserChange}>
            {PARSER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="ui-help">
            “Auto” escolhe um parser específico (Medium, GitHub etc.) e usa o genérico como fallback.
          </span>
        </label>
      </fieldset>

      <details className="ui-details">
        <summary>Avançado</summary>
        <div className="ui-details__content">
          <p className="ui-help">
            Preferências sincronizadas via <code>chrome.storage.sync</code>. Alterações em outra janela
            refletem aqui automaticamente.
          </p>
        </div>
      </details>

      <div className="ui-row">
        <button className="ui-button" onClick={resetToDefaults} disabled={isLoading}>
          Resetar para padrão
        </button>
        <span className="ui-meta">Versão da UI: <code>options</code></span>
      </div>
    </div>
  );
}
