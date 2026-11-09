import type { ReactNode } from 'react';
import type { Nivel } from '../tipos';

// Componentes de presentación reutilizables (portados de la interfaz de DeepSeek).

export type Tono = 'neutro' | 'ok' | 'aviso' | 'peligro' | 'critico' | 'info';

export function Kpi({ etiqueta, valor, detalle, tono = 'neutro' }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: Tono }) {
  return (
    <div className={`kpi ${tono !== 'neutro' ? `kpi--${tono}` : ''}`}>
      <div className="kpi__etiqueta">{etiqueta}</div>
      <div className="kpi__valor">{valor}</div>
      {detalle !== undefined && <div className="kpi__detalle">{detalle}</div>}
    </div>
  );
}

export function Distintivo({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`distintivo distintivo--${tono}`}>{children}</span>;
}

// Tabla 10 del informe: Atención ≥ 20 %, Severo ≥ 100 %, Crítico ≥ 300 % (valores configurables)
export const TONO_NIVEL: Record<Nivel, Tono> = { ATENCION: 'aviso', SEVERO: 'peligro', CRITICO: 'critico' };
export const ETIQUETA_NIVEL: Record<Nivel, string> = { ATENCION: 'Atención', SEVERO: 'Severo', CRITICO: 'Crítico' };

export function tonoHacinamiento(pct: number | null, u = { atencion: 20, severo: 100, critico: 300 }): Tono {
  if (pct === null) return 'neutro';
  if (pct >= u.critico) return 'critico';
  if (pct >= u.severo) return 'peligro';
  if (pct >= u.atencion) return 'aviso';
  return 'ok';
}

export function Barra({ pct, tono }: { pct: number | null; tono: Tono }) {
  // Escala hasta 450 %: Tacna (438 %) llena la barra; más allá no aporta información visual
  const ancho = Math.max(0, Math.min(100, ((pct ?? 0) / 450) * 100));
  return (
    <div className="barra" title={pct === null ? 'Sin datos' : `${pct.toFixed(1)} %`}>
      <div className={`barra__relleno barra__relleno--${tono}`} style={{ width: `${ancho}%` }} />
    </div>
  );
}

export function Hacinamiento({ pct, umbrales }: { pct: number | null; umbrales?: { atencion: number; severo: number; critico: number } }) {
  const tono = tonoHacinamiento(pct, umbrales);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 130 }}>
      <Barra pct={pct} tono={tono} />
      <span className={`distintivo distintivo--${tono}`} style={{ minWidth: 62, justifyContent: 'center' }}>
        {pct === null ? '-' : `${pct.toFixed(0)} %`}
      </span>
    </div>
  );
}

export function Cargando({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="vacio">
      <div className="spinner" style={{ margin: '0 auto 0.75rem' }} aria-hidden="true" />
      {texto}
    </div>
  );
}

export function Mensaje({ tipo, children }: { tipo: 'error' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`alerta-caja alerta-caja--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function CabeceraPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="pagina__cabecera">
      <div>
        <h1>{titulo}</h1>
        {descripcion && <p className="pagina__descripcion">{descripcion}</p>}
      </div>
      {acciones && <div className="fila-botones">{acciones}</div>}
    </div>
  );
}

export function Tarjeta({ titulo, nota, children, acciones }: { titulo?: string; nota?: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="tarjeta">
      {(titulo || acciones) && (
        <div className="tarjeta__titulo">
          <div>
            {titulo && <h3>{titulo}</h3>}
            {nota && <span className="tarjeta__nota">{nota}</span>}
          </div>
          {acciones && <div className="fila-botones">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({ titulo, children, pie, ancho, alCerrar }: { titulo: string; children: ReactNode; pie?: ReactNode; ancho?: boolean; alCerrar: () => void }) {
  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div className={`modal ${ancho ? 'modal--ancho' : ''}`}>
        <div className="modal__cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="boton boton--plano boton--chico" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        {children}
        {pie && <div className="modal__pie">{pie}</div>}
      </div>
    </div>
  );
}

export function Paginacion({ pagina, porPagina, total, alCambiar }: { pagina: number; porPagina: number; total: number; alCambiar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  return (
    <div className="paginacion">
      <span>Mostrando {desde}-{Math.min(pagina * porPagina, total)} de {total}</span>
      <div className="fila-botones">
        <button type="button" className="boton boton--chico" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>Anterior</button>
        <span>Página {pagina} de {paginas}</span>
        <button type="button" className="boton boton--chico" disabled={pagina >= paginas} onClick={() => alCambiar(pagina + 1)}>Siguiente</button>
      </div>
    </div>
  );
}

export function Definicion({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <div className="definicion__etiqueta">{etiqueta}</div>
      <div className="definicion__valor">{children}</div>
    </div>
  );
}

export function Campo({ id, etiqueta, children, ayuda }: { id: string; etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </div>
  );
}
