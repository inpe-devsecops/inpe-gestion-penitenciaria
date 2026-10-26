import { Router } from 'express';
import { z } from 'zod';
import { FichaDuplicada, type Auditar, type RepositorioInternos } from '../dominio';
import { puedeEditarFicha, puedeVerDatosPersonales } from '../seguridad/auth';

const codigoInterno = z.string().regex(/^INT-\d{7}$/);
const texto = (max: number) => z.string().trim().min(1).max(max);

// Lista blanca de campos (.strict): un campo no declarado, como penal_id o rol, se rechaza (asignación masiva, OWASP API3).
const esquemaNuevaFicha = z.object({
  codigo_interno: codigoInterno,
  pabellon_id: z.string().regex(/^EP\d{2}-P(\d{2}|M)$/),
  nombres: texto(80),
  apellido_paterno: texto(60),
  apellido_materno: z.string().trim().max(60).optional(),
  tipo_documento: z.enum(['DNI', 'CARNÉ DE EXTRANJERÍA', 'PASAPORTE']),
  numero_documento: z.string().regex(/^[A-Z0-9]{6,12}$/),
  sexo: z.enum(['M', 'F']),
  situacion_juridica: z.enum(['PROCESADO', 'SENTENCIADO']),
  delito: texto(120),
  numero_expediente: texto(40),
  fecha_ingreso: z.coerce.date().refine((f) => f <= new Date(), 'La fecha de ingreso no puede ser futura'),
}).strict();

const esquemaCambios = esquemaNuevaFicha
  .pick({ pabellon_id: true, nombres: true, apellido_paterno: true, apellido_materno: true, situacion_juridica: true, delito: true, numero_expediente: true })
  .partial()
  .strict()
  .refine((c) => Object.keys(c).length > 0, 'No hay cambios');

// Mensaje útil para el usuario sin detalles técnicos (RNF-23): solo qué campos corregir.
const camposInvalidos = (e: z.ZodError) => [...new Set(e.issues.map((i) => i.path.join('.') || 'cuerpo'))];

export function rutasInternos(internos: RepositorioInternos, auditar: Auditar) {
  const r = Router();

  r.get('/:codigo', async (req, res, next) => {
    try {
      const u = req.usuario;
      if (!u) return res.status(401).json({ error: 'No autenticado' });
      const codigo = codigoInterno.safeParse(req.params.codigo);
      if (!codigo.success) return res.status(400).json({ error: 'Código de interno inválido' });

      const base = { usuario_id: u.id, rol: u.rol, penal_usuario: u.penalId, ip: req.ip, accion: 'CONSULTA_FICHA_INTERNO', recurso: codigo.data };
      const ficha = await internos.buscarPorCodigo(codigo.data);
      if (!ficha) return res.status(404).json({ error: 'No encontrado' });

      // Un interno ajeno responde igual que uno inexistente (404): no confirma qué códigos existen (anti-enumeración).
      if (!puedeVerDatosPersonales(u, { penalId: ficha.penal_id, oficinaId: ficha.oficina_regional })) {
        await auditar({ ...base, resultado: 'DENEGADO', detalle: 'El interno está fuera del ámbito del usuario' });
        return res.status(404).json({ error: 'No encontrado' });
      }
      await auditar({ ...base, resultado: 'EXITO' });
      return res.json(ficha);
    } catch (e) {
      return next(e);
    }
  });

  // Registro de una ficha nueva: solo el director, y siempre en su propio penal (tomado del token, no del cuerpo).
  r.post('/', async (req, res, next) => {
    try {
      const u = req.usuario;
      if (!u) return res.status(401).json({ error: 'No autenticado' });
      const base = { usuario_id: u.id, rol: u.rol, penal_usuario: u.penalId, ip: req.ip, accion: 'REGISTRA_FICHA_INTERNO' };
      if (u.rol !== 'DIRECTOR_PENAL' || !u.penalId) {
        await auditar({ ...base, recurso: null, resultado: 'DENEGADO', detalle: 'Rol sin permiso para registrar fichas' });
        return res.status(403).json({ error: 'Acceso denegado' });
      }
      const datos = esquemaNuevaFicha.safeParse(req.body);
      if (!datos.success) return res.status(400).json({ error: 'Datos de la ficha inválidos', campos: camposInvalidos(datos.error) });

      const ficha = await internos.crear(u.penalId, { ...datos.data, apellido_materno: datos.data.apellido_materno ?? '' });
      await auditar({ ...base, recurso: ficha.codigo_interno, resultado: 'EXITO' });
      return res.status(201).json(ficha);
    } catch (e) {
      if (e instanceof FichaDuplicada) return res.status(409).json({ error: e.message });
      return next(e);
    }
  });

  // Corrección de una ficha existente: solo el director de su penal. Una ficha ajena responde 404, como en la consulta.
  r.patch('/:codigo', async (req, res, next) => {
    try {
      const u = req.usuario;
      if (!u) return res.status(401).json({ error: 'No autenticado' });
      const codigo = codigoInterno.safeParse(req.params.codigo);
      if (!codigo.success) return res.status(400).json({ error: 'Código de interno inválido' });

      const base = { usuario_id: u.id, rol: u.rol, penal_usuario: u.penalId, ip: req.ip, accion: 'ACTUALIZA_FICHA_INTERNO', recurso: codigo.data };
      const ficha = await internos.buscarPorCodigo(codigo.data);
      if (!ficha) return res.status(404).json({ error: 'No encontrado' });
      if (!puedeEditarFicha(u, ficha.penal_id)) {
        await auditar({ ...base, resultado: 'DENEGADO', detalle: 'El interno está fuera del ámbito del usuario' });
        return res.status(404).json({ error: 'No encontrado' });
      }
      const cambios = esquemaCambios.safeParse(req.body);
      if (!cambios.success) return res.status(400).json({ error: 'Datos de la ficha inválidos', campos: camposInvalidos(cambios.error) });

      const actualizada = await internos.actualizar(codigo.data, cambios.data);
      // Se auditan los nombres de los campos cambiados, nunca sus valores (sin datos personales en la bitácora).
      await auditar({ ...base, resultado: 'EXITO', detalle: `Campos: ${Object.keys(cambios.data).join(', ')}` });
      return res.json(actualizada);
    } catch (e) {
      return next(e);
    }
  });

  return r;
}
