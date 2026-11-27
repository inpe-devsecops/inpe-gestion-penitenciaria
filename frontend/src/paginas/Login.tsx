import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ErrorHttp, mensajeError } from '../api/cliente';
import { useAuth } from '../auth/AuthContext';
import { esCodigoTotp, limpiarCodigo } from '../auth/totp';
import { Mensaje } from '../componentes/Comunes';
import { MarcaSistema } from '../componentes/MarcaSistema';

// Usuarios ficticios creados por el seed (la contraseña es la de SEED_PASSWORD; nunca se muestra aquí)
const CUENTAS = [
  { username: 'admin.central', rol: 'Administrador central' },
  { username: 'admin.central2', rol: 'Administrador central (para decidir solicitudes ajenas)' },
  { username: 'regional.lima', rol: 'Responsable regional · Lima' },
  { username: 'director.ep-lurigancho', rol: 'Director · E.P. de Lurigancho' },
  { username: 'auditor', rol: 'Auditor · solo lectura' },
];

export function Login() {
  const { usuario, iniciarSesion, sesionExpirada } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Segundo factor (#23): el campo aparece solo cuando el servidor lo pide (TOTP_REQUERIDO)
  const [pideCodigo, setPideCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/panel';

  if (usuario) return <Navigate to={destino} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(username.trim(), password, pideCodigo ? codigo : undefined);
      navegar(destino, { replace: true });
    } catch (err) {
      if (err instanceof ErrorHttp && err.codigo === 'TOTP_REQUERIDO') {
        setPideCodigo(true);
      } else {
        setError(mensajeError(err));
        setCodigo('');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="login__caja">
        <MarcaSistema />
        <div className="tarjeta">
          <h1 className="login__titulo">Iniciar sesión</h1>
          <p className="login__subtitulo">Sistema de Gestión y Análisis de Población Penitenciaria</p>
          {sesionExpirada && !error && <Mensaje tipo="info">La sesión expiró o fue cerrada. Ingrese nuevamente.</Mensaje>}
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          {pideCodigo && !error && <Mensaje tipo="info">Esta cuenta usa segundo factor. Ingrese el código de su aplicación de autenticación.</Mensaje>}
          <form onSubmit={(e) => void enviar(e)}>
            <div className="campo">
              <label htmlFor="username">Usuario</label>
              <input id="username" autoComplete="username" required value={username} onChange={(e) => { setUsername(e.target.value); setPideCodigo(false); setCodigo(''); }} placeholder="nombre.usuario" />
            </div>
            <div className="campo">
              <label htmlFor="password">Contraseña</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {pideCodigo && (
              <div className="campo">
                <label htmlFor="codigo">Código de verificación</label>
                <input id="codigo" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={6}
                  value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} placeholder="000000" />
                <p className="campo__ayuda">Escriba los 6 dígitos que muestra su aplicación de autenticación. Cambian cada 30 segundos.</p>
              </div>
            )}
            <button type="submit" className="boton boton--primario" style={{ width: '100%' }} disabled={enviando || (pideCodigo && !esCodigoTotp(codigo))}>
              {enviando ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
          {import.meta.env.DEV && (
            <div className="login__demo">
              <h4>Usuarios de prueba (entorno local)</h4>
              {CUENTAS.map((c) => (
                <button key={c.username} type="button" className="login__cuenta" onClick={() => { setUsername(c.username); setError(null); }}>
                  <span>{c.username}</span>
                  <span className="login__cuenta-rol">{c.rol}</span>
                </button>
              ))}
              <p className="campo__ayuda" style={{ marginTop: '0.5rem' }}>
                La contraseña es la definida en SEED_PASSWORD. Ocupación real del INPE (enero 2026); las fichas de internos y los usuarios son ficticios.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
