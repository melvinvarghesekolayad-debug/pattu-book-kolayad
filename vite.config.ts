import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'WorkLog Pro - വർക്ക് മാനേജർ',
          short_name: 'WorkLog',
          description: 'തൊഴിലാളികൾക്കും മുതലാളിമാർക്കും വേണ്ടിയുള്ള വർക്ക് മാനേജർ ആപ്പ്.',
          theme_color: '#065f46',
          background_color: '#065f46',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'https://api.iconify.design/lucide:briefcase.svg?color=%23065f46&width=192&height=192',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: 'https://api.iconify.design/lucide:briefcase.svg?color=%23065f46&width=512&height=512',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
