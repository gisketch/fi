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
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'icons/fi-icon-192.png', 'icons/fi-icon-512.png', 'push-handler.js'],
      workbox: {
        importScripts: ['/push-handler.js']
      },
      manifest: {
        id: '/',
        name: 'Fi Personal Assistant',
        short_name: 'Fi',
        description: 'iOS Native PWA for talking to your Hermes.dev AI agent',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icons/fi-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/fi-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
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
        target: 'https://fi.gisketch.com',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.startsWith('/api/ws') ? path : path.replace(/^\/api/, ''),
      },
      '/usage-api': {
        target: 'http://167.254.240.228:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/usage-api/, ''),
      },
      '/terminal-gateway': {
        target: 'https://fi-terminal.gisketch.com',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/terminal-gateway/, ''),
      }
    }
  }
});
