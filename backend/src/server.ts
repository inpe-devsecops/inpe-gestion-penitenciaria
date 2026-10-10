import 'dotenv/config';
import mongoose from 'mongoose';
import { crearApp } from './app';
import { cargarConfig } from './config';
import { migrar } from './db/migrar';
import { evaluarAlertas } from './modulos/alertas/servicio';

async function main() {
  const config = cargarConfig();
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  const aplicadas = await migrar(mongoose.connection.db!);
  if (aplicadas.length) console.log(`Migraciones aplicadas: ${aplicadas.join(', ')}`);

  const app = crearApp({ config, baseDeDatosLista: () => mongoose.connection.readyState === 1 });
  const servidor = app.listen(config.port, () => console.log(`inpe-devsecops API escuchando en el puerto ${config.port}`));

  // Evaluador periódico de umbrales (RF-07): también resuelve las alertas cuyo indicador bajó
  if (config.intervaloAlertasMin > 0) {
    const evaluar = () => evaluarAlertas().catch((e: Error) => console.error(`Evaluación de alertas fallida: ${e.message}`));
    setTimeout(evaluar, 5_000).unref();
    setInterval(evaluar, config.intervaloAlertasMin * 60_000).unref();
  }

  const apagar = () => servidor.close(() => void mongoose.disconnect().then(() => process.exit(0)));
  process.on('SIGTERM', apagar);
  process.on('SIGINT', apagar);
}

main().catch((e: Error) => {
  console.error(`No se pudo iniciar: ${e.message}`);
  process.exit(1);
});
