import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, corte, numero } from '../api/cliente';
import { CabeceraPagina, Cargando, Distintivo, Hacinamiento, Kpi, Mensaje, Tarjeta, type Tono } from '../componentes/Comunes';
import type { Escenario, FilaProyeccion, Proyeccion } from '../tipos';

const ESCENARIO: Record<Escenario, { texto: string; tono: Tono }> = {
  YA_CRITICO: { texto: 'Ya en nivel crítico', tono: 'critico' },
  EN_RIESGO: { texto: 'En riesgo', tono: 'peligro' },
  SIN_RIESGO: { texto: 'Sin riesgo proyectado', tono: 'ok' },
  SIN_DATOS: { texto: 'Sin datos suficientes', tono: 'neutro' },
};

// La proyección siempre se muestra con su horizonte y su supuesto (apartado 2.2.4 del informe)
export function TextoProyeccion({ p }: { p: Proyeccion }) {
  const e = ESCENARIO[p.escenario];
  return (
    <div>
      <p style={{ marginTop: 0 }}><Distintivo tono={e.tono}>{e.texto}</Distintivo></p>
      <div className="definiciones">
        <div><div className="definicion__etiqueta">Población actual</div><div className="definicion__valor">{numero(p.poblacionActual)}</div></div>
        <div><div className="definicion__etiqueta">Nivel crítico</div><div className="definicion__valor">{numero(p.poblacionCritica)}</div></div>
        <div><div className="definicion__etiqueta">Ritmo mensual</div><div className="definicion__valor">{p.pendienteMensual === null ? '-' : `${p.pendienteMensual > 0 ? '+' : ''}${p.pendienteMensual.toFixed(1)}`}</div></div>
        <div><div className="definicion__etiqueta">Llegaría al nivel crítico</div><div className="definicion__valor">
          {p.escenario === 'EN_RIESGO' ? `en ${p.mesesHastaCritico} meses (${corte(p.corteEstimado)})` : p.escenario === 'YA_CRITICO' ? 'ya lo superó' : '-'}
        </div></div>
      </div>
      <p className="campo__ayuda" style={{ marginTop: '0.75rem' }}>
        <strong>Supuesto:</strong> {p.supuesto}
        {p.horizonte && <> Horizonte analizado: {corte(p.horizonte.desde)} a {corte(p.horizonte.hasta)}.</>} Es una estimación propia, no una proyección oficial del INPE.
      </p>
    </div>
  );
}

export function Proyecciones() {
  const { data, isLoading, error } = useQuery({ queryKey: ['proyecciones'], queryFn: () => api<FilaProyeccion[]>('/api/proyecciones') });
  if (isLoading) return <Cargando texto="Ajustando tendencias..." />;
  if (error || !data) return <Mensaje tipo="error">{(error as Error)?.message}</Mensaje>;
  const cuenta = (e: Escenario) => data.filter((p) => p.escenario === e).length;
  return (
    <>
      <CabeceraPagina titulo="Proyección de saturación" descripcion="Meses estimados hasta el nivel crítico, ordenados por urgencia. Cada fila usa la serie mensual del establecimiento con un supuesto de crecimiento lineal." />
      <div className="rejilla rejilla--kpis" style={{ marginBottom: '1rem' }}>
        <Kpi etiqueta="Ya en nivel crítico" valor={cuenta('YA_CRITICO')} tono="critico" />
        <Kpi etiqueta="En riesgo" valor={cuenta('EN_RIESGO')} detalle={`${data.filter((p) => p.escenario === 'EN_RIESGO' && (p.mesesHastaCritico ?? 99) <= 6).length} en 6 meses o menos (prospectiva)`} tono="peligro" />
        <Kpi etiqueta="Sin riesgo proyectado" valor={cuenta('SIN_RIESGO')} tono="ok" />
      </div>
      <Tarjeta>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Establecimiento</th><th>Hacinamiento</th><th>Escenario</th><th className="tabla__num">Ritmo / mes</th><th className="tabla__num">Meses al crítico</th><th>Fecha estimada</th></tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.establecimiento.id}>
                  <td><Link to={`/establecimientos/${p.establecimiento.id}`} className="tabla__nombre">{p.establecimiento.nombre}</Link><span className="tabla__sub">{p.establecimiento.oficina}</span></td>
                  <td><Hacinamiento pct={p.establecimiento.hacinamientoPct} /></td>
                  <td><Distintivo tono={ESCENARIO[p.escenario].tono}>{ESCENARIO[p.escenario].texto}</Distintivo></td>
                  <td className="tabla__num">{p.pendienteMensual === null ? '-' : p.pendienteMensual.toFixed(1)}</td>
                  <td className="tabla__num">{p.mesesHastaCritico ?? '-'}</td>
                  <td>{corte(p.corteEstimado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </>
  );
}
