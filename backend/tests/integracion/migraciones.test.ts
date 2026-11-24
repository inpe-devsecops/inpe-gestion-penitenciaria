import mongoose from 'mongoose';
import { migrar } from '../../src/db/migrar';
import { cerrarBase, prepararBase } from './entorno';

beforeAll(async () => {
  await prepararBase('migraciones');
});
afterAll(cerrarBase);

// Validador de una base creada antes de completar el catalogo del art. 159
const VALIDADOR_ANTERIOR = { $jsonSchema: { bsonType: 'object', properties: { causal: { enum: ['ORDEN_JUDICIAL', 'OTROS'] } } } };

const solicitud = (n: number, causal: string) => ({
  codigo: `TR-MIG-${n}`, interno_id: `INT-9000${n}`, origen_id: 'EP-LURIGANCHO', causal,
  fundamento_cifrado: 'v1:x:y:z', estado: 'RECHAZADA', en_tramite: false,
  solicitante_id: 'USR-0001', solicitada_en: new Date(),
});

const simularBaseAnterior = async () => {
  const db = mongoose.connection.db!;
  await db.command({ collMod: 'solicitudes_traslado', validator: VALIDADOR_ANTERIOR, validationLevel: 'strict', validationAction: 'error' });
  await db.collection('migraciones').deleteOne({ _id: '003_causales_art159' });
  return db;
};

describe('Migracion 003: validador de causales del art. 159 en una base ya creada', () => {
  it('la base anterior rechaza las causales nuevas y la migracion las admite', async () => {
    const db = await simularBaseAnterior();
    const col = db.collection('solicitudes_traslado');
    await expect(col.insertOne(solicitud(1, 'SEGURIDAD_PERSONAL'))).rejects.toMatchObject({ code: 121 });

    expect(await migrar(db)).toEqual(['003_causales_art159']);

    await col.insertOne(solicitud(2, 'SEGURIDAD_PERSONAL'));
    await col.insertOne(solicitud(3, 'SEGURIDAD_PENITENCIARIA'));
    await expect(col.insertOne(solicitud(4, 'OTROS'))).rejects.toMatchObject({ code: 121 });
    await col.deleteMany({ codigo: { $regex: '^TR-MIG-' } });
  });

  it('se detiene sin modificar datos si hay solicitudes con una causal fuera del catalogo', async () => {
    const db = await simularBaseAnterior();
    const col = db.collection('solicitudes_traslado');
    await col.insertOne(solicitud(5, 'OTROS'));

    await expect(migrar(db)).rejects.toThrow(/fuera del art\. 159/);
    expect(await col.countDocuments({ codigo: 'TR-MIG-5' })).toBe(1);
    expect(await db.collection('migraciones').countDocuments({ _id: '003_causales_art159' })).toBe(0);

    await col.deleteMany({ codigo: { $regex: '^TR-MIG-' } });
    expect(await migrar(db)).toEqual(['003_causales_art159']);
  });
});
