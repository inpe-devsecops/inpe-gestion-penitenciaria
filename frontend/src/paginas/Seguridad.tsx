import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensajeError } from '../api/cliente';
import { agruparClave, esCodigoTotp, limpiarCodigo } from '../auth/totp';
import { CabeceraPagina, Campo, Cargando, Mensaje, Tarjeta } from '../componentes/Comunes';
import type { EnrolamientoTotp, Sesion } from '../tipos';

const estiloClave = { fontFamily: 'Consolas, "Courier New", monospace', fontSize: '1.15rem', letterSpacing: '0.08em', wordBreak: 'break-all' } as const;

// Segundo factor TOTP del administrador central (#23, Tabla 16: Suplantación).
// La clave se muestra una sola vez y solo vive en la memoria de esta página: no se guarda en el navegador.
export function Seguridad() {
  const cliente = useQueryClient();
  const yo = useQuery({ queryKey: ['auth', 'me'], queryFn: () => api<Sesion>('/api/auth/me') });
  const [enrolamiento, setEnrolamiento] = useState<EnrolamientoTotp | null>(null);
  const [codigo, setCodigo] = useState('');

  const enrolar = useMutation({
    mutationFn: () => api<EnrolamientoTotp>('/api/auth/totp/enrolar', { metodo: 'POST' }),
    onSuccess: (r) => { setEnrolamiento(r); setCodigo(''); },
  });
  const activar = useMutation({
    mutationFn: () => api<void>('/api/auth/totp/activar', { metodo: 'POST', cuerpo: { codigo } }),
    onSuccess: () => { setEnrolamiento(null); setCodigo(''); void cliente.invalidateQueries({ queryKey: ['auth', 'me'] }); },
    onError: () => setCodigo(''),
  });

  if (yo.isLoading) return <Cargando />;
  if (yo.error || !yo.data) return <Mensaje tipo="error">{mensajeError(yo.error)}</Mensaje>;

  const confirmar = (e: FormEvent) => {
    e.preventDefault();
    activar.mutate();
  };

  return (
    <>
      <CabeceraPagina titulo="Seguridad de la cuenta"
        descripcion="Segundo factor de autenticación (TOTP): además de la contraseña, el ingreso pide un código de 6 dígitos que cambia cada 30 segundos." />
      {activar.isSuccess && <Mensaje tipo="ok">Segundo factor activado. Desde ahora el ingreso pedirá el código de su aplicación.</Mensaje>}

      {yo.data.totpActivo ? (
        <Tarjeta titulo="Segundo factor activo" nota="Cuenta protegida">
          <p>
            Su cuenta pide un código de su aplicación de autenticación en cada ingreso. Si pierde el celular, comuníquese
            con el equipo técnico para restablecer el segundo factor.
          </p>
        </Tarjeta>
      ) : !enrolamiento ? (
        <Tarjeta titulo="Segundo factor desactivado" nota="Recomendado para el administrador central">
          <p>
            Su cuenta tiene el mayor privilegio del sistema. Con el segundo factor, una contraseña filtrada no alcanza para
            entrar. Necesita una aplicación de autenticación en su celular: Google Authenticator, Microsoft Authenticator o Authy.
          </p>
          {enrolar.error && <Mensaje tipo="error">{mensajeError(enrolar.error)}</Mensaje>}
          <button type="button" className="boton boton--primario" disabled={enrolar.isPending} onClick={() => enrolar.mutate()}>
            {enrolar.isPending ? 'Generando...' : 'Configurar segundo factor'}
          </button>
        </Tarjeta>
      ) : (
        <Tarjeta titulo="Configurar segundo factor" nota="La clave se muestra una sola vez">
          <ol>
            <li>
              En su aplicación de autenticación, elija <strong>Agregar cuenta → Ingresar una clave de configuración</strong> y
              escriba esta clave (tipo: <strong>basada en el tiempo</strong>):
              <p style={estiloClave} aria-label="Clave de configuración">{agruparClave(enrolamiento.secreto)}</p>
              Si está en el celular, también puede <a href={enrolamiento.uri}>abrir la clave directamente en su aplicación</a>.
            </li>
            <li>Escriba el código de 6 dígitos que muestra la aplicación para confirmar.</li>
          </ol>
          {activar.error && <Mensaje tipo="error">{mensajeError(activar.error)}. Revise que la hora del celular sea automática y use el código nuevo.</Mensaje>}
          <form onSubmit={confirmar}>
            <Campo id="codigo-totp" etiqueta="Código de verificación" ayuda="Cambia cada 30 segundos.">
              <input id="codigo-totp" inputMode="numeric" autoComplete="one-time-code" required maxLength={6}
                value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} placeholder="000000" />
            </Campo>
            <button type="submit" className="boton boton--primario" disabled={activar.isPending || !esCodigoTotp(codigo)}>
              {activar.isPending ? 'Verificando...' : 'Activar segundo factor'}
            </button>
          </form>
        </Tarjeta>
      )}
    </>
  );
}
