/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  globals: {
    'ts-jest': { tsconfig: 'tsconfig.test.json' },
  },
  testTimeout: 30000,
  setupFiles: ['<rootDir>/test/e2e/env-setup.ts'],
}
