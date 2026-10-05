import 'dotenv/config';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { crearApp } from './app';
import { cargarConfig } from './config';
import { auditarEnMongo, repositorioInternos, repositorioUsuarios, rutasCapacidad } from './repositorios/mongo';

async function main() {
  const config = cargarConfig();
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);

  const app = crearApp({
    config,
    internos: repositorioInternos(config.dataKey),
    usuarios: repositorioUsuarios(),
    auditar: auditarEnMongo,
    verificarPassword: (hash, password) => argon2.verify(hash, password),
    rutasCapacidad: rutasCapacidad(),
    baseDeDatosLista: () => mongoose.connection.readyState === 1,
  });

  app.listen(config.port, () => console.log(`inpe-devsecops API escuchando en el puerto ${config.port}`));
}

main().catch((e: Error) => {
  console.error(`No se pudo iniciar: ${e.message}`);
  process.exit(1);
});
