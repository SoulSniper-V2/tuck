import js from '@eslint/js';

export default [
    {ignores: ['dist/**', 'node_modules/**']},
    js.configs.recommended,
    {files: ['tests/nativePreferences.js', 'tests/compatibilityPreferences.js'], languageOptions: {globals: {imports: 'readonly', TextDecoder: 'readonly'}}},
    {
        languageOptions: {
            ecmaVersion: 2025,
            sourceType: 'module',
            globals: {global: 'readonly', URL: 'readonly', console: 'readonly', print: 'readonly', logError: 'readonly'},
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-constant-binary-expression': 'error',
        },
    },
    {files: ['legacy/*.js', 'tests/classicPreferences.js'], languageOptions: {sourceType: 'script', globals: {imports: 'readonly', ARGV: 'readonly'}}},
];
