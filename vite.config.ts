import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'fenix-icon-32.png',
        'fenix-icon-180.png',
        'fenix-icon-192.png',
        'fenix-icon-512.png',
      ],

      manifest: {
        name: 'FÉNIX',
        short_name: 'FÉNIX',

        description:
          'FÉNIX — entrenamiento, nutrición, rutina y progreso.',

        lang: 'es',

        start_url: '/',
        scope: '/',

        display: 'standalone',

        background_color: '#050506',
        theme_color: '#050506',

        icons: [
          {
            src: '/fenix-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/fenix-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },

      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webmanifest}',
        ],
      },
    }),
  ],
})