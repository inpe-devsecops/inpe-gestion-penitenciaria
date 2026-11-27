import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, fijarToken, registrarManejadorNoAutorizado } from '../api/cliente';
import type { Rol, Sesion } from '../tipos';

interface ValorAuth {
  usuario: Sesion | null;
  // codigo: los 6 dígitos de la app de autenticación, solo si la cuenta tiene TOTP activo (#23)
  iniciarSesion: (username: string, password: string, codigo?: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  tieneRol: (...roles: Rol[]) => boolean;
  sesionExpirada: boolean;
}

const Contexto = createContext<ValorAuth | null>(null);

const ROLES: readonly Rol[] = ['ADMIN_CENTRAL', 'RESPONSABLE_REGIONAL', 'DIRECTOR_ESTABLECIMIENTO', 'AUDITOR'];
const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN_CENTRAL: 'Administrador central',
  RESPONSABLE_REGIONAL: 'Responsable regional',
  DIRECTOR_ESTABLECIMIENTO: 'Director de establecimiento',
  AUDITOR: 'Auditor',
};

function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && ROLES.some((rol) => rol === valor);
}

function rolDelToken(token: string): Rol {
  const segmento = token.split('.')[1];
  if (!segmento) throw new Error('El servidor devolvió una sesión inválida. Intente ingresar nuevamente.');

  let contenido: string;
  try {
    const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
    contenido = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  } catch {
    throw new Error('El servidor devolvió una sesión inválida. Intente ingresar nuevamente.');
  }

  let claims: unknown;
  try {
    claims = JSON.parse(contenido);
  } catch {
    throw new Error('El servidor devolvió una sesión inválida. Intente ingresar nuevamente.');
  }

  if (typeof claims !== 'object' || claims === null || !('rol' in claims) || !esRol(claims.rol)) {
    throw new Error('El servidor devolvió una sesión sin un rol válido. Intente ingresar nuevamente.');
  }
  return claims.rol;
}

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Sesion | null>(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const cliente = useQueryClient();

  // Un 401 en cualquier llamada (token vencido o revocado) cierra la sesión local
  useEffect(() => {
    registrarManejadorNoAutorizado(() => {
      setUsuario(null);
      setSesionExpirada(true);
      cliente.clear();
    });
  }, [cliente]);

  const iniciarSesion = useCallback(async (username: string, password: string, codigo?: string) => {
    const cuerpo = codigo ? { username, password, codigo } : { username, password };
    const r = await api<{ token: string; expiraEn: number; usuario: Sesion }>('/api/auth/login', { metodo: 'POST', cuerpo });
    const rol = rolDelToken(r.token);
    fijarToken(r.token);
    setSesionExpirada(false);
    setUsuario({ ...r.usuario, rol, rolLabel: ETIQUETA_ROL[rol] });
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await api('/api/auth/logout', { metodo: 'POST' }); // revoca el token en el servidor
    } catch {
      // aunque falle la revocación, la sesión local se cierra
    }
    fijarToken(null);
    setUsuario(null);
    cliente.clear();
  }, [cliente]);

  const valor = useMemo<ValorAuth>(() => ({
    usuario, iniciarSesion, cerrarSesion, sesionExpirada,
    tieneRol: (...roles) => (usuario ? roles.includes(usuario.rol) : false),
  }), [usuario, iniciarSesion, cerrarSesion, sesionExpirada]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ValorAuth {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth debe usarse dentro de ProveedorAuth');
  return c;
}
