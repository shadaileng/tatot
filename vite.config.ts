import path from 'node:path'
import fs from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'

function injectAppidPlugin(): Plugin {
  return {
    name: 'vite-plugin-inject-appid',
    closeBundle() {
      const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '')
      const appid = env.TAROT_APPID
      if (!appid) return

      const urlCheck = env.TAROT_URL_CHECK === undefined ? false : env.TAROT_URL_CHECK === 'true'
      const mode = process.env.NODE_ENV || 'development'
      const dir = mode === 'production' ? 'dist/build/mp-weixin' : 'dist/dev/mp-weixin'
      const configPath = path.resolve(__dirname, dir, 'project.config.json')
      try {
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          let changed = false
          if (config.appid !== appid) {
            config.appid = appid
            changed = true
          }
          if (!config.setting) config.setting = {}
          if (config.setting.urlCheck !== urlCheck) {
            config.setting.urlCheck = urlCheck
            changed = true
          }
          if (changed) {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
          }
        }
      } catch {}
    },
  }
}

export default defineConfig({
  plugins: [
    uni(),
    WeappTailwindcss({
      rem2rpx: true,
      cssEntries: [path.resolve(__dirname, 'src/app.css')],
    }),
    injectAppidPlugin(),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/variables.scss";',
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // CloudStudio 需要监听所有网络接口
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
