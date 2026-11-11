/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Las pruebas de integración usan una base MongoDB real (MONGODB_URI_TEST)
  testTimeout: 60_000,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/db/seed.ts'],
  // Compuerta de cobertura: si el proyecto baja de estos umbrales, `npm test` falla y el
  // pipeline no promueve a Producción. Objetivo del curso: 85 % de sentencias y ramas.
  // Se parte del nivel actual y se sube de forma progresiva (sin volver a bajarlo) a medida
  // que cada funcionalidad incorpora sus pruebas.
  coverageThreshold: {
    global: { statements: 74, branches: 45, functions: 68, lines: 78 },
    // Las capas de seguridad se mantienen por encima de la meta del curso.
    './src/seguridad/': { statements: 85, branches: 70, functions: 85, lines: 88 },
  },
};
