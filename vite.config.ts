import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'fenix-icon.svg',
      ],

      manifest: {
        name: 'FÉNIX',
        short_name: 'FÉNIX',
        description:
          'Sistema personal de rutina, entrenamiento, nutrición y progreso.',

        start_url: '/',
        scope: '/',

        display: 'standalone',

        background_color: '#0d0d0d',
        theme_color: '#0d0d0d',

        icons: [
          {
            src: '/fenix-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/fenix-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,

        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,webp,gif}',
        ],
      },
    }),
  ],
})