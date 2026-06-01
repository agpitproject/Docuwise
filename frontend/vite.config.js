import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const googleAuthHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    headers: googleAuthHeaders,

    proxy: {
      '/api': {
        target: 'https://docuwisebackend.onrender.com',
        changeOrigin: true,
        
      },
    },
  },

  preview: {
    headers: googleAuthHeaders,
  },
});
