import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'test-results/**', 'playwright-report/**', '.civ-backups/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Civilization packs may only use the public SDK, never engine internals.
    files: ['civilizations/**/*.{ts,tsx}'],
    ignores: ['civilizations/*/seed/**', 'civilizations/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@engine/*', '../../src/*', '../../../src/*'], message: 'Les packs utilisent uniquement @sdk (API publique).' },
            { group: ['@studio/*', '@game/*'], message: 'Les packs ne dépendent pas du Studio ni du jeu.' },
          ],
        },
      ],
    },
  },
  {
    files: ['tools/**/*.ts', 'tests/e2e/**/*.ts', '*.config.ts', '*.config.js', 'civilizations/*/seed/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
