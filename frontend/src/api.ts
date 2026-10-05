// Capa de servicios: los componentes no llaman a fetch directamente (capas + abstracción).
const BASE = import.meta.env.VITE_API_URL ?? '';

export interface FilaCapacidad {
  penal_id: string;
  nombre: string;
  oficina_regional: string;
  capacidad: number;
  poblacion: number;
  sobrepoblacion_pct: number;
  hacinamiento: boolean;
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((cuerpo as { error?: string }).error ?? `Error ${res.status}`);
  return cuerpo as T;
}

export const api = {
  login: (username: string, password: string) =>
    pedir<{ token: string; expira_en: number }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  capacidad: (token: string) => pedir<FilaCapacidad[]>('/api/capacidad', {}, token),
};
