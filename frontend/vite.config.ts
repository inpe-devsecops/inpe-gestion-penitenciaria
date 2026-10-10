import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo las llamadas /api van al backend local; en producción, a la URL del API (VITE_API_URL).
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    rollupOptions: {
      // Las librerías cambian poco: en su propio archivo el navegador las conserva en caché entre versiones
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'], graficos: ['recharts'] } },
    },
  },
});
