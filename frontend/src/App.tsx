import { useEffect, useState, type FormEvent } from 'react';
import { api, type FilaCapacidad } from './api';

// El token vive solo en memoria (no en localStorage): se pierde al recargar, a cambio de no exponerlo a XSS.
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  return token ? <Tablero token={token} onSalir={() => setToken(null)} /> : <Login onIngreso={setToken} />;
}

function Login({ onIngreso }: { onIngreso: (t: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      onIngreso((await api.login(username, password)).token);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="login">
      <h1>inpe-devsecops</h1>
      <p>Gestión segura de la población penitenciaria</p>
      <form onSubmit={enviar}>
        <label>Usuario<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit">Ingresar</button>
      </form>
    </main>
  );
}

function Tablero({ token, onSalir }: { token: string; onSalir: () => void }) {
  const [filas, setFilas] = useState<FilaCapacidad[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.capacidad(token).then(setFilas).catch((e: Error) => setError(e.message));
  }, [token]);

  const total = filas.reduce((a, f) => ({ cap: a.cap + f.capacidad, pob: a.pob + f.poblacion }), { cap: 0, pob: 0 });

  return (
    <main className="tablero">
      <header>
        <h1>Ocupación de establecimientos penitenciarios</h1>
        <button onClick={onSalir}>Cerrar sesión</button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {filas.length > 0 && (
        <p className="resumen">
          <strong>{(total.pob - total.cap).toLocaleString('es-PE')}</strong> internos sin cupo · capacidad {total.cap.toLocaleString('es-PE')} · población {total.pob.toLocaleString('es-PE')}
        </p>
      )}
      <table>
        <thead><tr><th>Penal</th><th>Oficina regional</th><th>Capacidad</th><th>Población</th><th>Sobrepoblación</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.penal_id}>
              <td>{f.nombre}</td><td>{f.oficina_regional}</td>
              <td className="num">{f.capacidad.toLocaleString('es-PE')}</td><td className="num">{f.poblacion.toLocaleString('es-PE')}</td>
              <td className="num">{f.hacinamiento ? '⚠ ' : ''}{f.sobrepoblacion_pct} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
