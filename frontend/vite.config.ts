import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Render define RENDER_GIT_COMMIT al construir: el smoke test del pipeline lo busca en el index.html publicado
const marcarVersion = (commit = ''): Plugin => ({
  name: 'marcar-version',
  transformIndexHtml: (html) => html.replace('__VERSION__', /^[0-9a-f]{7,40}$/.test(commit) ? commit.slice(0, 7) : 'local'),
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), marcarVersion(loadEnv(mode, '.', '').RENDER_GIT_COMMIT)],
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
}));
