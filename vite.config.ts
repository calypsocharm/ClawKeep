import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Expose the API_KEY from the build environment to the client code
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom'],
          // Google Gemini AI SDK
          'vendor-gemini': ['@google/genai'],
          // PDF generation
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // Canvas / image utilities
          'vendor-canvas': ['html2canvas'],
          // Sanitization
          'vendor-sanitize': ['dompurify'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true,
  },
});