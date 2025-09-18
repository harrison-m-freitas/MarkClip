import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExportOptions, ParserName } from '~/types';

const DEFAULTS: ExportOptions = {
  embedImages: false,
  includeMetadata: true,
  parser: 'auto',
};

const PARSER_OPTIONS: Array<{ value: ExportOptions['parser']; label: string }> = [
  { value: 'auto',          label: 'Auto (recomendado)' },
  { value: 'generic',       label: 'Genérico' },
  { value: 'medium',        label: 'Medium' },
  { value: 'github-readme', label: 'GitHub README' },
  { value: 'tryhackme',     label: 'Try Hack Me'},
  
];

const SAVE_DEBOUNCE_MS = 250;

export default function App() {
  const [opts, setOpts] = useState<ExportOptions>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOk, setExportOk] = useState<boolean | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await browser.storage.sync.get(['embedImages', 'includeMetadata', 'parser']);
        if (!mounted) return;
        setOpts({
          embedImages: r.embedImages ?? DEFAULTS.embedImages,
          includeMetadata: r.includeMetadata ?? DEFAULTS.includeMetadata,
          parser: (r.parser as ParserName | undefined) ?? DEFAULTS.parser,
        });
        setIsLoading(false);
      } catch {
        setErrorMsg('Falha ao carregar preferências.');
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
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
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }, [opts]);

  function scheduleSave(next: ExportOptions) {
    setOpts(next);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await browser.storage.sync.set(next);
        setJustSaved(true);
        window.setTimeout(() => setJustSaved(false), 900);
      } catch {
        setErrorMsg('Falha ao salvar alterações.');
      }
    }, SAVE_DEBOUNCE_MS) as unknown as number;
  }

  function save<K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) {
    scheduleSave({ ...opts, [key]: value });
  }

  async function exportNow() {
    setExportOk(null);
    setErrorMsg(null);
    try {
      setExporting(true);
      const ack = await browser.runtime.sendMessage({ type: 'EXPORT_NOW' });
      // o download em si é disparado no BG; aqui só sinalizamos “ok”
      if (ack?.ok) {
        setExportOk(true);
        setTimeout(() => window.close(), 700);
      } else {
        setExportOk(false);
      }
    } catch {
      setErrorMsg('Não foi possível iniciar a exportação.');
      setExportOk(false);
    } finally {
      setExporting(false);
    }
  }

  const status = useMemo(() => {
    if (isLoading) return { text: 'Carregando…', tone: 'muted' as const };
    if (errorMsg) return { text: errorMsg, tone: 'danger' as const };
    if (justSaved) return { text: 'Preferências salvas ✓', tone: 'success' as const };
    if (exportOk === false) return { text: 'Falha ao exportar', tone: 'danger' as const };
    if (exportOk === true) return { text: 'Download iniciado ✓', tone: 'success' as const };
    return { text: '', tone: 'muted' as const };
  }, [isLoading, errorMsg, justSaved, exportOk]);

  const embedId = 'popup-embed';
  const fmId = 'popup-frontmatter';
  const parserId = 'popup-parser';

  return (
    <div className="ui-surface p-4 min-w-72">
      <header className="mb-3">
        <h1 className="ui-title">MarkClip</h1>
        <p className="ui-subtitle">Exporte a página atual para um .md com imagens e frontmatter.</p>
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

      <fieldset className="ui-fieldset" disabled={isLoading || exporting}>
        <label htmlFor={embedId} className="ui-switch">
          <input
            id={embedId}
            type="checkbox"
            checked={opts.embedImages}
            onChange={(e) => save('embedImages', e.target.checked)}
            aria-describedby="desc-embed"
          />
          <span className="ui-switch__label">Embeder imagens (base64)</span>
        </label>
        <p id="desc-embed" className="ui-help">
          Converte <code>&lt;img&gt;</code> em <code>data:</code> URLs. Arquivos maiores podem não embutir.
        </p>

        <label htmlFor={fmId} className="ui-switch">
          <input
            id={fmId}
            type="checkbox"
            checked={opts.includeMetadata}
            onChange={(e) => save('includeMetadata', e.target.checked)}
          />
          <span className="ui-switch__label">Incluir metadata (frontmatter)</span>
        </label>

        <label className="ui-label" htmlFor={parserId}>
          Parser
          <select
            id={parserId}
            className="ui-select"
            value={opts.parser}
            onChange={(e) => save('parser', e.target.value as ExportOptions['parser'])}
          >
            {PARSER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </fieldset>

      <button
        className={`ui-button ui-button--primary ui-button--block ${exporting ? 'is-busy' : ''}`}
        onClick={exportNow}
        disabled={isLoading || exporting}
      >
        {exporting ? 'Exportando…' : 'Exportar agora'}
      </button>

      <div className="ui-row">
        <p className="ui-kbdline">
          Atalho: <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd>
        </p>
        <button className="ui-link" onClick={() => browser.runtime.openOptionsPage()} disabled={exporting}>
          Abrir opções
        </button>
      </div>
    </div>
  );
}
