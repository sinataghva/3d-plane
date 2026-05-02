import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['dist/', 'node_modules/']
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        rules: {
            'no-console': ['warn', { allow: ['warn', 'error'] }]
        }
    },
    {
        files: ['**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.vitest
            }
        }
    }
];
