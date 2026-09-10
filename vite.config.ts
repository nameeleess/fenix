import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import {
  REPDB_MEDIA_ITEMS,
  REPDB_PACKAGE_VERSION,
  REPDB_PRECACHE_SOURCE_IDS,
} from './scripts/media-freeze-v21.mjs'

const mediaBySourceId = new Map(REPDB_MEDIA_ITEMS.map((item) => [item.sourceId, item]))
const repdbSeedThumbnails = REPDB_PRECACHE_SOURCE_IDS.map((sourceId) => {
  const item = mediaBySourceId.get(sourceId)
  if (!item) throw new Error(`Media Freeze: sourceId de precache desconocido: ${sourceId}`)
  const suffix = item.variant === 'main' ? 'main' : 'start'
  return {
    url: `/media/exercises/repdb/${REPDB_PACKAGE_VERSION}/${sourceId}-${suffix}.webp`,
    revision: `repdb-${REPDB_PACKAGE_VERSION}`,
  }
})

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'prompt',

      includeAssets: [
        'fenix-icon-32.png',
        'fenix-icon-180.png',
        'fenix-icon-192.png',
        'fenix-icon-512.png',
      ],

      manifest: {
        id: '/',
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
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        // RepDB WebP are package-local. Only seed-routine thumbnails are precached;
        // remaining detail frames are cached on first use to keep install weight bounded.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webmanifest}',
          'media/exercises/fenix/*.webp',
          'media/exercises/user-licensed/*.webp',
        ],
        additionalManifestEntries: repdbSeedThumbnails,
        runtimeCaching: [
          {
            urlPattern: /\/media\/exercises\/repdb\/.*\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: `fenix-repdb-media-${REPDB_PACKAGE_VERSION}`,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
