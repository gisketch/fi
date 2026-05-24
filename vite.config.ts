import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Fi Personal Assistant',
        short_name: 'Fi',
        description: 'iOS Native PWA for talking to your Hermes.dev AI agent',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://167.254.240.228:8643',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.startsWith('/api/ws') ? path : path.replace(/^\/api/, ''),
      },
      '/usage-api': {
        target: 'http://167.254.240.228:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/usage-api/, ''),
      }
    }
  }
});
