import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",             // default: "."
  modulesDir: "wxt-modules", // default: "modules"
  outDir: "dist",            // default: ".output"

  manifest: {
    name: 'MarkClip',
    description:
      'Exporta a página atual para Markdown (.md) com suporte a imagens, blocos de código e parsers por domínio.',
    version: '1.0.0',

    action: {
      default_popup: 'popup.html',
      default_title: 'Exportar para Markdown',
    },

    permissions: ['activeTab', 'scripting', 'downloads', 'storage', 'contextMenus'],
    host_permissions: ['<all_urls>'],

    commands: {
      export_markdown: {
        suggested_key: { default: 'Ctrl+Shift+M', mac: 'Command+Shift+M' },
        description: 'Exportar página atual como Markdown',
      },
    },

    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/64.png',
      '128': 'icon/128.png',
      '256': 'icon/256.png'
    },
  },
});
