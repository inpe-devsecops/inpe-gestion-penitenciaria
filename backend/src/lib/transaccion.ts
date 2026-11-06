import mongoose, { type ClientSession } from 'mongoose';

let soportaTransacciones: boolean | null = null;

// Ejecuta fn dentro de una transacción si el servidor la soporta (replica set, como MongoDB Atlas).
// En un MongoDB standalone de desarrollo se ejecuta sin transacción: por eso cada operación del flujo
// usa además actualizaciones condicionales (p. ej. { estado: 'APROBADA' }) que fallan si otro proceso
// cambió el documento antes.
export async function conTransaccion<T>(fn: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
  if (soportaTransacciones === null) {
    const hola = await mongoose.connection.db!.admin().command({ hello: 1 });
    soportaTransacciones = Boolean(hola.setName || hola.msg === 'isdbgrid');
  }
  if (!soportaTransacciones) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let resultado!: T;
    await session.withTransaction(async () => {
      resultado = await fn(session);
    });
    return resultado;
  } finally {
    await session.endSession();
  }
}
