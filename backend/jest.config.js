/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleNameMapper: {
    '^@pg/engine$': '<rootDir>/../engine/src/index.ts',
    '^@pg/parser$': '<rootDir>/../parser/src/index.ts',
  },
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: { ignoreCodes: [151002] } }],
  },
  testTimeout: 30000,
};
