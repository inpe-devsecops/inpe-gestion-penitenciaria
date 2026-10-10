import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ProveedorAuth } from './auth/AuthContext';
import './estilos/global.css';

const cliente = new QueryClient({
  // La ocupación cambia al ejecutarse un traslado: se reconsulta al volver a la pestaña
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProveedorAuth>
          <App />
        </ProveedorAuth>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
