import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
// https://github.com/vdesjs/vite-plugin-monaco-editor/issues/21#issuecomment-1827562674
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'
import tailwindcss from '@tailwindcss/vite'

const isObjectWithDefaultFunction = (
  module: unknown
): module is { default: typeof monacoEditorPluginModule } =>
  module != null &&
  typeof module === 'object' &&
  'default' in module &&
  typeof module.default === 'function'
const monacoEditorPlugin = isObjectWithDefaultFunction(monacoEditorPluginModule)
  ? monacoEditorPluginModule.default
  : monacoEditorPluginModule

// Legacy build (Win7 / macOS 10.15): bundle all deps to CJS, only externalize native modules
// Electron 22 (Win7) and Electron 32 (Catalina) require CJS main/preload output.
const isLegacyBuild = process.env.LEGACY_BUILD === 'true'
const legacyExternal = ['electron', 'age-encryption']
// 分网站打包：编译时注入当前网站 id（无 SITE 时为 ''，表示包含全部网站）
const siteId = process.env.SITE?.trim() || ''

export default defineConfig({
  main: {
    define: { __SITE_ID__: JSON.stringify(siteId) },
    plugins: isLegacyBuild ? [] : undefined,
    build: {
      externalizeDeps: isLegacyBuild
        ? { exclude: ['age-encryption'] }
        : { exclude: ['age-encryption'] },
      rollupOptions: isLegacyBuild
        ? { external: legacyExternal, output: { format: 'cjs' } }
        : undefined
    }
  },
  preload: {
    plugins: isLegacyBuild ? [] : undefined,
    build: {
      externalizeDeps: true,
      rollupOptions: isLegacyBuild
        ? {
            external: legacyExternal,
            output: {
              format: 'cjs',
              entryFileNames: '[name].cjs'
            }
          }
        : undefined
    }
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          floating: resolve('src/renderer/floating.html'),
          traymenu: resolve('src/renderer/traymenu.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService', 'typescript', 'css'],
        customDistPath: (_, out) => `${out}/monacoeditorwork`,
        customWorkers: [
          {
            label: 'yaml',
            entry: 'monaco-yaml/yaml.worker'
          }
        ]
      })
    ]
  }
})
