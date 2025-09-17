import type { UiToBgMessage } from '~/types';
import { COMMANDS, CONTEXT_MENU_IDS } from '~/constants';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(async () => {
    try {
      await chrome.contextMenus.removeAll();
    } catch {}
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.EXPORT_MD,
      title: 'Exportar como Markdown',
      contexts: ['page', 'selection'],
    });
  });

  chrome.runtime.onStartup?.addListener(async () => {
    try {
      await chrome.contextMenus.removeAll();
    } catch {}
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.EXPORT_MD,
      title: 'Exportar como Markdown',
      contexts: ['page', 'selection'],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_IDS.EXPORT_MD && tab?.id) {
      // (Opcional) Se quiser exportar só a seleção:
      // await requestExport(tab.id, typeof info.selectionText === 'string' ? info.selectionText : undefined);
      await requestExport(tab.id);
    }
  });

  chrome.commands.onCommand.addListener(async (command) => {
    if (command === COMMANDS.EXPORT_MARKDOWN) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await requestExport(tab.id);
    }
  });

  async function requestExport(tabId: number, /*, selection?: string */) {
    let res = await chrome.tabs
      .sendMessage(tabId, { type: 'EXPORT_MARKDOWN' /*, selection*/ } as unknown as UiToBgMessage)
      .catch((err) => {
        console.warn('[BG] sendMessage falhou (provavelmente CS não injetado ainda)', err);
        return null;
      });

    if (!res || !('ok' in res) || !res.ok) {
      try {
        await chrome.scripting.executeScript({
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

      res = await chrome.tabs
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
    await downloadMarkdown(res.filename as string, res.markdown as string);
  }

  async function downloadMarkdown(filename: string, markdown: string) {
    const dataUrl =
      'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown);

    try {
      await chrome.downloads.download({
        url: dataUrl,
        filename,
        saveAs: true,
        conflictAction: 'uniquify',
      });
    } catch (err) {
      console.error('[BG] Falha ao iniciar download do Markdown', err);
    }
  }

  // Mensagens diretas do popup para exportar
  chrome.runtime.onMessage.addListener((msg: UiToBgMessage, _sender, sendResponse) => {
    if (msg?.type === 'EXPORT_NOW') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
        if (tab?.id) await requestExport(tab.id);
      });
      sendResponse({ ok: true });
      return true;
    }
  });

});
