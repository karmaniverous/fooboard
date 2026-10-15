/**
 * Vite config: React + Tailwind v4 static browser app. `base: './'` keeps
 * the build relocatable (Amplify Hosting serves it from the site root, but
 * the build itself makes no assumption about the final path).
 *
 * @module
 */
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (
            /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)
          ) {
            return 'react-vendor';
          }
          if (/node_modules[\\/]@aws-sdk[\\/]/.test(id)) {
            return 'aws-amplify';
          }
          return undefined;
        },
      },
    },
  },
});
