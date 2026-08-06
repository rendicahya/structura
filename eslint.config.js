import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteConfig from './svelte.config.js';
import globals from 'globals';

export default [
    js.configs.recommended,
    ...svelte.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
    },
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parserOptions: {
                svelteConfig,
            },
        },
    },
    {
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'svelte/no-unused-svelte-ignore': 'warn',
        },
    },
    {
        ignores: ['dist/', 'node_modules/', '.opencode/'],
    },
];
