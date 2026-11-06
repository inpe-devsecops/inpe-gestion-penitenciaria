import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Rol } from '../tipos';
import { useAuth } from './AuthContext';

// Defensa de interfaz, no de seguridad: la autorización real la impone la API en cada petición (RNF-22).
export function RutaProtegida({ children, roles }: { children: ReactNode; roles?: Rol[] }) {
  const { usuario } = useAuth();
  const ubicacion = useLocation();
  if (!usuario) return <Navigate to="/login" state={{ desde: ubicacion.pathname }} replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/no-autorizado" replace />;
  return <>{children}</>;
}
