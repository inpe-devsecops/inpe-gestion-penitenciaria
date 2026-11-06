import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida } from './auth/RutaProtegida';
import { Layout } from './componentes/Layout';
import { Alertas } from './paginas/Alertas';
import { Auditoria } from './paginas/Auditoria';
import { DetalleEstablecimiento } from './paginas/DetalleEstablecimiento';
import { DetalleInterno } from './paginas/DetalleInterno';
import { DetalleTraslado } from './paginas/DetalleTraslado';
import { Establecimientos } from './paginas/Establecimientos';
import { Internos } from './paginas/Internos';
import { Login } from './paginas/Login';
import { NoAutorizado } from './paginas/NoAutorizado';
import { PanelPrincipal } from './paginas/Panel';
import { Parametros } from './paginas/Parametros';
import { Proyecciones } from './paginas/Proyecciones';
import { Traslados } from './paginas/Traslados';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/no-autorizado" element={<NoAutorizado />} />
      <Route element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route index element={<Navigate to="/panel" replace />} />
        <Route path="/panel" element={<PanelPrincipal />} />
        <Route path="/establecimientos" element={<Establecimientos />} />
        <Route path="/establecimientos/:id" element={<DetalleEstablecimiento />} />
        <Route path="/internos" element={<Internos />} />
        <Route path="/internos/:id" element={<DetalleInterno />} />
        <Route path="/traslados" element={<Traslados />} />
        <Route path="/traslados/:id" element={<DetalleTraslado />} />
        <Route path="/alertas" element={<Alertas />} />
        <Route path="/proyecciones" element={<Proyecciones />} />
        <Route path="/parametros" element={<RutaProtegida roles={['ADMIN_CENTRAL', 'AUDITOR']}><Parametros /></RutaProtegida>} />
        <Route path="/auditoria" element={<RutaProtegida roles={['ADMIN_CENTRAL', 'AUDITOR']}><Auditoria /></RutaProtegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
