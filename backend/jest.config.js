/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Las pruebas de integración usan una base MongoDB real (MONGODB_URI_TEST)
  testTimeout: 60_000,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/db/seed.ts'],
};
