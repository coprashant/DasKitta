import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
      manifest: {
        name: 'DasKitta — Nepal IPO and NEPSE Tracker',
        short_name: 'DasKitta',
        description: 'Apply for NEPSE IPOs across all your Meroshare accounts in one click. Track your stock portfolio, check IPO allotment results, and monitor live Nepal stock market data.',
        theme_color: '#1e6fb5',
        background_color: '#141b26',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        id: '/',
        lang: 'en-NP',
        categories: ['finance', 'utilities'],
        screenshots: [
          {
            src: 'daskitta.png',
            sizes: '1200x630',
            type: 'image/png',
            label: 'DasKitta home screen showing IPO applications and NEPSE data'
          }
        ],
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '629x629',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})