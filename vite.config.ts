import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
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
          'icons': ['lucide-react'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'date-utils': ['date-fns'],
          'editor': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder'],
          'query': ['@tanstack/react-query'],
          'dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
          'virtual': ['@tanstack/react-virtual'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 800, // Reduced limit to catch large chunks early
    target: 'es2020', // Sweet spot: broad compat + small output
  },
}));
