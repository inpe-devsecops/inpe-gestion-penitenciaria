import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, fijarToken, registrarManejadorNoAutorizado } from '../api/cliente';
import type { Rol, Sesion } from '../tipos';

interface ValorAuth {
  usuario: Sesion | null;
  iniciarSesion: (username: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  tieneRol: (...roles: Rol[]) => boolean;
  sesionExpirada: boolean;
}

const Contexto = createContext<ValorAuth | null>(null);

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

  const iniciarSesion = useCallback(async (username: string, password: string) => {
    const r = await api<{ token: string; expiraEn: number; usuario: Sesion }>('/api/auth/login', { metodo: 'POST', cuerpo: { username, password } });
    fijarToken(r.token);
    setSesionExpirada(false);
    setUsuario(r.usuario);
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
