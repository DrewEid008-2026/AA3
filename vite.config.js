import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  plugins: [
    {
      name: 'base44-local-mock-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (
            url.startsWith('/api/') ||
            url.startsWith('/apps/') ||
            url.includes('/public-settings') ||
            url.includes('/analytics/') ||
            url.includes('/entities/')
          ) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            if (url.includes('/public-settings')) {
              res.end(JSON.stringify({ id: 'local-app', public_settings: {} }));
            } else if (url.includes('/entities/User/me')) {
              res.end(JSON.stringify({ id: 'local-commander', email: 'commander@earth.defense' }));
            } else {
              res.end(JSON.stringify({ success: true }));
            }
            return;
          }
          next();
        });
      },
    },
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: false,
      navigationNotifier: false,
      analyticsTracker: false,
      visualEditAgent: false
    }),
    react(),
  ]
});
