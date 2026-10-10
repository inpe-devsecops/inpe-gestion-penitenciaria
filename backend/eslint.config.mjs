import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'jest.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Falso positivo sistemático: marca todo acceso obj[clave]. Aquí las claves son uniones literales de
      // TypeScript (roles, parámetros, niveles) y la entrada del usuario se valida con Zod antes de usarse.
      // La inyección NoSQL se controla en seguridad/sanitizar.ts y la detecta Semgrep en el pipeline.
      'security/detect-object-injection': 'off',
    },
  },
);
