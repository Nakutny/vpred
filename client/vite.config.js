import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // Smaller chunks = faster initial load
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached across all pages
          'vendor-react': ['react', 'react-dom'],
          // Router — almost always needed, but separate from React
          'vendor-router': ['react-router-dom'],
          // Heavy admin-only page — only loaded when admin visits /admin
          'page-admin': ['./src/pages/AdminPage.jsx'],
          // Markdown renderer (if used) — lazy chunk
          'vendor-markdown': ['react-markdown'],
        },
      },
    },
    // Minify with esbuild (default, but explicit for clarity)
    minify: 'esbuild',
    // Generate source maps only in dev; skip in production for smaller bundles
    sourcemap: false,
    // Target modern browsers only — smaller output
    target: 'es2020',
  },

  // Optimize dev server
  server: {
    hmr: { overlay: true },
  },

  // Pre-bundle heavy dependencies for faster dev cold starts
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
});
