import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import { ROL_LABEL } from '../../dominio/constantes';
import { auditar } from '../../lib/auditoria';
import { conflicto, noEncontrado, ruta } from '../../lib/errores';
import { Establecimiento, OficinaRegional, Sesion, Usuario, type UsuarioDoc } from '../../modelos';
import { autenticar, DURACION_TOKEN_SEG, emitirToken, esRol, requiereRol } from '../../seguridad/auth';
import { cifrar, descifrar } from '../../seguridad/cripto';
import { generarSecretoTotp, uriOtpauth, verificarTotp } from '../../seguridad/totp';

export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

const esquemaLogin = z.object({
  username: z.string().regex(/^[a-z0-9._-]{3,50}$/),
  password: z.string().min(1).max(128),
  // Código de 6 dígitos de la app de autenticación; solo se exige a quien tiene TOTP activo (#23)
  codigo: z.string().regex(/^\d{6}$/).optional(),
});
const esquemaCodigo = z.object({ codigo: z.string().regex(/^\d{6}$/) });

// Guarda el paso usado solo si es posterior al último: si dos peticiones llegan a la vez con el
// mismo código, solo una lo consume (la actualización es atómica en MongoDB).
async function consumirPaso(usuarioId: string, paso: number, extra: Record<string, unknown> = {}) {
  const r = await Usuario.updateOne(
    { _id: usuarioId, $or: [{ totp_ultimo_paso: null }, { totp_ultimo_paso: { $lt: paso } }] },
    { $set: { totp_ultimo_paso: paso, ...extra } },
  );
  return r.modifiedCount === 1;
}

// Hash señuelo: se verifica también cuando el usuario no existe para que el tiempo de respuesta
// no revele qué cuentas existen.
let senuelo: Promise<string> | null = null;
const hashSenuelo = () => (senuelo ??= argon2.hash('contraseña-señuelo-que-nunca-coincide', { type: argon2.argon2id }));

export async function sesionDto(u: UsuarioDoc) {
  const [oficina, est] = await Promise.all([
    u.ambito?.oficina_id ? OficinaRegional.findById(u.ambito.oficina_id, { nombre: 1 }).lean() : null,
    u.ambito?.establecimiento_id ? Establecimiento.findById(u.ambito.establecimiento_id, { nombre: 1, oficina_id: 1 }).lean() : null,
  ]);
  return {
    id: u._id, username: u.username, nombreCompleto: u.nombre_completo, rol: u.rol, rolLabel: ROL_LABEL[u.rol],
    oficinaId: u.ambito?.oficina_id ?? null, oficina: oficina?.nombre ?? null,
    establecimientoId: u.ambito?.establecimiento_id ?? null, establecimiento: est?.nombre ?? null,
    totpActivo: Boolean(u.totp_activo),
  };
}

export function rutasAuth(
  jwtSecret: string,
  verificarPassword: (hash: string, password: string) => Promise<boolean> = (h, p) => argon2.verify(h, p),
  ahora: () => Date = () => new Date(),
) {
  const r = Router();

  r.post('/login', ruta(async (req, res) => {
    const datos = esquemaLogin.safeParse(req.body);
    if (!datos.success) return res.status(400).json({ error: 'Entrada inválida', codigo: 'VALIDACION' });
    const evento = { accion: 'LOGIN', entidad: 'usuarios' } as const;
    const u = await Usuario.findOne({ username: datos.data.username }).lean() as UsuarioDoc | null;

    // Mismo mensaje para usuario inexistente, inactivo o contraseña errónea
    if (!u || u.estado !== 'ACTIVO' || !esRol(u.rol)) {
      await verificarPassword(await hashSenuelo(), datos.data.password).catch(() => false);
      await auditar(req, { ...evento, resultado: 'FALLIDO', detalle: 'Credenciales inválidas' }, undefined, { id: null, rol: null });
      return res.status(401).json({ error: 'Credenciales inválidas', codigo: 'NO_AUTENTICADO' });
    }
    const quien = { id: u._id, rol: u.rol };
    if (u.bloqueado_hasta && u.bloqueado_hasta > ahora()) {
      await auditar(req, { ...evento, entidad_id: u._id, resultado: 'BLOQUEADO', detalle: 'Intento sobre cuenta bloqueada' }, undefined, quien);
      return res.status(423).json({ error: 'Cuenta bloqueada temporalmente', codigo: 'BLOQUEADO' });
    }
    // Un fallo de contraseña o de código cuenta para el bloqueo: sin esto, el código de 6 dígitos
    // se podría adivinar por fuerza bruta una vez filtrada la contraseña.
    const fallo = async (detalle: string) => {
      const intentos = (u.intentos_fallidos ?? 0) + 1;
      const bloqueo = intentos >= MAX_INTENTOS ? new Date(ahora().getTime() + BLOQUEO_MS) : null;
      await Usuario.updateOne({ _id: u._id }, { $set: { intentos_fallidos: bloqueo ? 0 : intentos, bloqueado_hasta: bloqueo } });
      await auditar(req, { ...evento, entidad_id: u._id, resultado: bloqueo ? 'BLOQUEADO' : 'FALLIDO',
        detalle: bloqueo ? 'Cuenta bloqueada 15 minutos' : detalle }, undefined, quien);
      return bloqueo
        ? res.status(423).json({ error: 'Cuenta bloqueada temporalmente', codigo: 'BLOQUEADO' })
        : res.status(401).json({ error: 'Credenciales inválidas', codigo: 'NO_AUTENTICADO' });
    };
    if (!(await verificarPassword(u.password_hash, datos.data.password))) return fallo('Contraseña incorrecta');

    // Segundo factor (#23): con TOTP activo, la contraseña sola no basta para obtener un token
    if (u.totp_activo) {
      if (!datos.data.codigo) {
        await auditar(req, { ...evento, entidad_id: u._id, resultado: 'FALLIDO', detalle: 'Falta el segundo factor' }, undefined, quien);
        return res.status(401).json({ error: 'Ingrese el código de su aplicación de autenticación', codigo: 'TOTP_REQUERIDO' });
      }
      const secreto = descifrar(u.totp_secreto_cifrado ?? '', req.app.locals.dataKey as Buffer);
      const paso = verificarTotp(secreto, datos.data.codigo, u.totp_ultimo_paso ?? null, ahora());
      if (paso === null || !(await consumirPaso(u._id, paso))) return fallo('Código TOTP inválido o ya usado');
    }

    const t = emitirToken({ id: u._id, rol: u.rol, oficinaId: u.ambito?.oficina_id ?? null, establecimientoId: u.ambito?.establecimiento_id ?? null }, jwtSecret);
    await Sesion.create({ _id: t.jti, usuario_id: u._id, emitida_en: ahora(), expira: t.expira });
    await Usuario.updateOne({ _id: u._id }, { $set: { intentos_fallidos: 0, bloqueado_hasta: null, ultimo_acceso: ahora() } });
    await auditar(req, { ...evento, entidad_id: u._id, resultado: 'EXITO' }, undefined, quien);
    return res.json({ token: t.token, expiraEn: DURACION_TOKEN_SEG, usuario: await sesionDto(u) });
  }));

  r.get('/me', autenticar(jwtSecret), ruta(async (req, res) => {
    const u = await Usuario.findById(req.usuario!.id).lean() as UsuarioDoc | null;
    if (!u) throw noEncontrado('Usuario');
    res.json(await sesionDto(u));
  }));

  // Revoca el token actual: deja de servir aunque no haya expirado (RNF-04)
  r.post('/logout', autenticar(jwtSecret), ruta(async (req, res) => {
    await Sesion.updateOne({ _id: req.usuario!.jti }, { $set: { revocada: true, revocada_en: new Date() } });
    await auditar(req, { accion: 'LOGOUT', entidad: 'usuarios', entidad_id: req.usuario!.id, resultado: 'EXITO' });
    res.status(204).end();
  }));

  // ----- Enrolamiento del segundo factor (#23), solo para el administrador central (mayor privilegio).
  // Paso 1: genera el secreto y lo deja pendiente (cifrado). La app de autenticación lo lee desde la URI.
  r.post('/totp/enrolar', autenticar(jwtSecret), requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const u = await Usuario.findById(req.usuario!.id).lean() as UsuarioDoc | null;
    if (!u) throw noEncontrado('Usuario');
    if (u.totp_activo) throw conflicto('El segundo factor ya está activo');
    const secreto = generarSecretoTotp();
    await Usuario.updateOne({ _id: u._id }, { $set: {
      totp_secreto_cifrado: cifrar(secreto, req.app.locals.dataKey as Buffer), totp_activo: false, totp_ultimo_paso: null,
    } });
    await auditar(req, { accion: 'TOTP_ENROLAR', entidad: 'usuarios', entidad_id: u._id, resultado: 'EXITO' });
    // El secreto se muestra una sola vez, a su dueño; no queda en la auditoría ni en los logs
    res.json({ secreto, uri: uriOtpauth(u.username, secreto) });
  }));

  // Paso 2: el usuario demuestra que su app genera códigos válidos; recién ahí se exige en el login
  r.post('/totp/activar', autenticar(jwtSecret), requiereRol('ADMIN_CENTRAL'), ruta(async (req, res) => {
    const datos = esquemaCodigo.safeParse(req.body);
    if (!datos.success) return res.status(400).json({ error: 'Entrada inválida', codigo: 'VALIDACION' });
    const u = await Usuario.findById(req.usuario!.id).lean() as UsuarioDoc | null;
    if (!u) throw noEncontrado('Usuario');
    if (u.totp_activo) throw conflicto('El segundo factor ya está activo');
    if (!u.totp_secreto_cifrado) throw conflicto('Primero inicie el enrolamiento');
    const evento = { accion: 'TOTP_ACTIVAR', entidad: 'usuarios', entidad_id: u._id } as const;
    const secreto = descifrar(u.totp_secreto_cifrado, req.app.locals.dataKey as Buffer);
    const paso = verificarTotp(secreto, datos.data.codigo, u.totp_ultimo_paso ?? null);
    if (paso === null || !(await consumirPaso(u._id, paso, { totp_activo: true }))) {
      await auditar(req, { ...evento, resultado: 'FALLIDO', detalle: 'Código TOTP inválido' });
      return res.status(400).json({ error: 'Código inválido', codigo: 'TOTP_INVALIDO' });
    }
    await auditar(req, { ...evento, resultado: 'EXITO' });
    return res.status(204).end();
  }));

  return r;
}
