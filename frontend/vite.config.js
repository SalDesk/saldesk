import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/public': 'http://localhost:3001'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router-dom') || /[/\\]react[/\\]/.test(id)) {
              return 'vendor-react';
            }
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
          }
          if (id.includes('/pages/admin/')) {
            return 'chunk-admin';
          }
          if (
            id.includes('/pages/Dashboard') ||
            id.includes('/pages/Reservations') ||
            id.includes('/pages/Calendar') ||
            id.includes('/pages/Customers') ||
            id.includes('/pages/Units') ||
            id.includes('/pages/Housekeeping') ||
            id.includes('/pages/Maintenance') ||
            id.includes('/pages/MenuDigital')
          ) {
            return 'chunk-dashboard';
          }
          if (
            id.includes('/pages/PublicBooking') ||
            id.includes('/pages/ServiceDetail') ||
            id.includes('/pages/AffiliatePortal') ||
            id.includes('/pages/StaffPortal')
          ) {
            return 'chunk-public';
          }
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js']
  }
});
