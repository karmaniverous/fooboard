/**
 * ESLint flat config: strict type-checked TypeScript rules, TSDoc syntax,
 * import sorting, React Hooks / Fast Refresh rules & Prettier for all
 * TS/TSX files; Vitest rules for tests.
 *
 * @module
 */
import eslint from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['coverage/**/*', 'dist/**/*', 'node_modules/**/*'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      prettier: prettierPlugin,
      'simple-import-sort': simpleImportSortPlugin,
      tsdoc: tsdocPlugin,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'tsdoc/syntax': 'warn',
      'prettier/prettier': 'error',
      // CONTRIBUTING: no unchecked narrowing; files stay under 300 lines.
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      // Every export, test utilities included, states what it returns.
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'max-lines': ['error', { max: 300 }],
    },
  },
  {
    // CONTRIBUTING (Use library controls): native selects, collapsibles
    // and checkboxes only inside the library wrappers in src/components.
    files: ['src/**/*.tsx'],
    ignores: ['src/components/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: 'Use Choice (the library Select), not a native <select>.',
        },
        {
          selector: 'JSXOpeningElement[name.name=/^(details|summary)$/]',
          message:
            'Use Disclosure (or the library Collapsible), not native <details>/<summary>.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='checkbox']",
          message:
            'Use CheckField (the library Checkbox with its Label), not a native checkbox.',
        },
        {
          selector:
            "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'] > JSXExpressionContainer > Literal[value='checkbox']",
          message:
            'Use CheckField (the library Checkbox with its Label), not a native checkbox.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    extends: [vitest.configs.recommended],
  },
  prettierConfig,
);
