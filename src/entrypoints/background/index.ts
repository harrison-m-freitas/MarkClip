import type { UiToBgMessage } from '~/types';
import { COMMANDS, CONTEXT_MENU_IDS } from '~/constants';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void browser.contextMenus.removeAll().catch(() => {});
    browser.contextMenus.create({
      id: CONTEXT_MENU_IDS.EXPORT_MD,
      title: 'Exportar como Markdown',
      contexts: ['page', 'selection'],
    })
  });

  browser.runtime.onStartup?.addListener(() => {
    void browser.contextMenus.removeAll().catch(() => {});
    browser.contextMenus.create({
      id: CONTEXT_MENU_IDS.EXPORT_MD,
      title: 'Exportar como Markdown',
      contexts: ['page', 'selection'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_IDS.EXPORT_MD && tab?.id) {
      // (Opcional) Se quiser exportar só a seleção:
      // await requestExport(tab.id, typeof info.selectionText === 'string' ? info.selectionText : undefined);
      void requestExport(tab.id);
    }
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === COMMANDS.EXPORT_MARKDOWN) {
      void (async () => {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await requestExport(tab.id);
      })
    }
  });

  const blobUrls = new Map<number, string>();

  browser.downloads.onChanged.addListener((delta) => {
    if (!delta || typeof delta.id !== 'number') return;
    const url = blobUrls.get(delta.id);
    if (!url) return;
    if (delta.state?.current === 'complete' || delta.state?.current === 'interrupted') {
      try { URL.revokeObjectURL(url); } catch {}
      blobUrls.delete(delta.id);
    }
  });

  async function requestExport(tabId: number, /*, selection?: string */) {
    let res = await browser.tabs
      .sendMessage(tabId, { type: 'EXPORT_MARKDOWN' /*, selection*/ } as unknown as UiToBgMessage)
      .catch((err) => {
        console.warn('[BG] sendMessage falhou (provavelmente CS não injetado ainda)', err);
        return null;
      });

    if (!res || !('ok' in res) || !res.ok) {
      try {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['content-scripts/content.js'],
          // world: 'ISOLATED', // default em MV3; ajuste se precisar tocar no DOM da página
        });
      } catch (err) {
        console.warn(
          '[BG] Não foi possível injetar o content script. A página pode bloquear injeção (chrome://, loja, PDF, ou permissões).',
          err,
        );
        return;
      }

      res = await browser.tabs
        .sendMessage(tabId, { type: 'EXPORT_MARKDOWN' /*, selection*/ } as unknown as UiToBgMessage)
        .catch((err) => {
          console.warn('[BG] sendMessage falhou mesmo após injetar CS', err);
          return null;
        });
      
      if (!res || !('ok' in res) || !res.ok) {
        console.warn('[BG] Export falhou: content script não respondeu ou retornou erro.', res);
        return;
      }
    }
    await downloadMarkdown(res.filename as string, res.markdown as string, tabId);
  }

  async function downloadMarkdown(filename: string, markdown: string, tabId: number) {
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const id = await browser.downloads.download({
        url,
        filename,
        saveAs: true,
        conflictAction: 'uniquify'
      });

      blobUrls.set(id, url);
      return;
    } catch (err) {
      console.warn('[BG] Blob download falhou; tentando fallback pelo content script…', err);
    }

    try {
      await browser.tabs.sendMessage(tabId, {
        type: 'FORCE_DOWNLOAD_FALLBACK',
        filename,
        markdown
      });
    } catch (err) {
       console.error('[BG] Fallback de download também falhou', err);
    }
  }

  // Mensagens diretas do popup para exportar
  browser.runtime.onMessage.addListener((msg: UiToBgMessage) => {
    if (msg?.type === 'EXPORT_NOW') {
      return (async () => {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await requestExport(tab.id);
        return { ok: true as const };
      })();
    }
  });

});
