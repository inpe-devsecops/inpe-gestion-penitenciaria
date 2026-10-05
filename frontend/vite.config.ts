import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo las llamadas /api van al backend local; en producción, a la URL del API (VITE_API_URL).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
