import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // Keep the bar reasonable for a new repo; tighten later.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Avoid blocking lint on existing code patterns; tighten later.
      'no-empty': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];
