import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    // Playwright's webServer overrides this (own port, strict) so E2E never
    // collides with — or silently reuses — an unrelated dev server on :8080.
    port: Number(process.env.VITE_DEV_SERVER_PORT) || 8080,
    strictPort: Boolean(process.env.VITE_DEV_SERVER_PORT),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
    },
  },
  build: {
    sourcemap: mode === 'production' ? 'hidden' : true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        pure_funcs: mode === 'production' ? ['console.debug', 'console.log'] : [],
        passes: 2, // Multiple compression passes for better optimization
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false, // Remove all comments in production
      },
    },
    cssMinify: 'lightningcss', // Faster CSS minification
    cssCodeSplit: true, // Split CSS per component
    reportCompressedSize: false, // Faster builds by skipping gzip size report
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', '@radix-ui/react-popover'],
          'ui-forms': ['@radix-ui/react-checkbox', '@radix-ui/react-select', '@radix-ui/react-switch', '@radix-ui/react-label'],
          'ui-extras': ['@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-avatar', '@radix-ui/react-collapsible'],
          'supabase': ['@supabase/supabase-js'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'date-utils': ['date-fns'],
          'editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder'],
          'query': ['@tanstack/react-query'],
          'dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
          'virtual': ['@tanstack/react-virtual'],
        },
        // 'icons' (lucide-react) and 'charts' (recharts) were previously forced into single
        // shared chunks. Because ErrorBoundary — mounted eagerly at the app root — imports a
        // handful of icons, that grouping made Rollup treat the ENTIRE icon set (every icon
        // used anywhere, including admin-only pages) as a static, eagerly-modulepreloaded
        // dependency of every route (~574KB, always). Leaving them out lets Rollup's default
        // per-usage chunking scope icons/charts to the routes that actually need them.
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 800, // Reduced limit to catch large chunks early
    target: 'es2020', // Sweet spot: broad compat + small output
  },
}));
