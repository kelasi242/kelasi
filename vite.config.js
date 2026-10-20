import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'icons/kelasi-180.png', 'icons/kelasi-192.png', 'icons/kelasi-512.png', 'icons/kelasi-maskable-512.png', 'icons/apple-touch-icon-180.png', 'icons/favicon-32.png', 'favicon.svg'],
      manifest: false, // Le manifeste est fourni explicitement dans public/manifest.webmanifest.
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'], navigateFallback: 'index.html', cleanupOutdatedCaches: true }
    })
  ]
});
