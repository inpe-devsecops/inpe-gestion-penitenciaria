import { Link } from 'react-router-dom';
import { CabeceraPagina, Mensaje } from '../componentes/Comunes';

export function NoAutorizado() {
  return (
    <div className="contenido" style={{ maxWidth: 640, margin: '3rem auto' }}>
      <CabeceraPagina titulo="Acceso no autorizado" />
      <Mensaje tipo="error">Su rol no tiene permiso para ver esta sección. Si cree que es un error, contacte al administrador central.</Mensaje>
      <Link to="/panel" className="boton">Volver al panel</Link>
    </div>
  );
}
