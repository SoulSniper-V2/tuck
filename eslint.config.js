import js from '@eslint/js';

export default [
    {ignores: ['dist/**', 'node_modules/**']},
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2025,
            sourceType: 'module',
            globals: {global: 'readonly', console: 'readonly'},
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-constant-binary-expression': 'error',
        },
    },
];

