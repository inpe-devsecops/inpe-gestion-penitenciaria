import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { crearApp } from '../../src/app';
import { cargarConfig } from '../../src/config';

// Variables mínimas válidas; cada prueba agrega o cambia solo lo que verifica
const base = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/inpe_test_health',
  JWT_SECRET: 'secreto-de-pruebas-con-mas-de-32-caracteres!!',
  DATA_KEY: randomBytes(32).toString('base64'),
};

describe('Health check con la versión desplegada (smoke test del pipeline)', () => {
  it('toma los 7 primeros caracteres del commit que define Render', () => {
    // Arrange
    const env = { ...base, RENDER_GIT_COMMIT: 'a1df8e4c0ffee1234567890abcdef1234567890a' };
    // Act
    const config = cargarConfig(env);
    // Assert
    expect(config.version).toBe('a1df8e4');
  });

  it('rechaza un commit con formato inválido (fail-safe al iniciar)', () => {
    const env = { ...base, RENDER_GIT_COMMIT: '<script>' };
    expect(() => cargarConfig(env)).toThrow('Configuración inválida');
  });

  it('responde el estado y la versión, sin otros datos internos', async () => {
    const app = crearApp({ config: { ...cargarConfig(base), version: 'a1df8e4' } });
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'ok', version: 'a1df8e4' });
  });

  it('fuera de Render informa "local"', async () => {
    const app = crearApp({ config: cargarConfig(base) });
    const r = await request(app).get('/health');
    expect(r.body.version).toBe('local');
  });

  it('responde 503 si la base de datos no está lista', async () => {
    const app = crearApp({ config: cargarConfig(base), baseDeDatosLista: () => false });
    const r = await request(app).get('/health');
    expect(r.status).toBe(503);
    expect(r.body.status).toBe('degradado');
  });
});
