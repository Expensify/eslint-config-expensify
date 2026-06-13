/**
 * ESLint file globs for Jest test, mock, and setup files.
 */
const jestFiles = [
    'tests/**',
    'test/**',
    'spec/**',
    '**/__tests__/**',
    '**/__mocks__/**',
    'test.{js,jsx}',
    'test-*.{js,jsx}',
    '**/*.{test,spec}.{js,jsx,mjs,cjs}',
    '**/*.{test,spec}.{ts,tsx,cts,mts}',
    '**/*_test.{js,jsx,ts,tsx}',
    '**/jest.config.{js,ts,mts}',
    '**/jest.setup.{js,ts}',
    'jestSetup.js',
];

export default jestFiles;
