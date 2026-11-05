import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const useExternalAssets = command === 'build' && mode === 'production'
  const repository = process.env.GITHUB_REPOSITORY || 'mirasaveher/BrownDust2-L2D-Viewer'
  const revision = process.env.GITHUB_SHA || 'main'
  const externalAssetBase = env.VITE_ASSET_BASE_URL
    || `https://raw.githubusercontent.com/${repository}/${revision}/public_final/`

  return {
    plugins: [vue()],
    base: '/',
    define: {
      'import.meta.env.VITE_ASSET_BASE_URL': JSON.stringify(useExternalAssets ? externalAssetBase : ''),
    },
    publicDir: useExternalAssets ? false : 'public_final',
    server: {
      host: '0.0.0.0',
    },
  }
})
