const path = require('path');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, '../../server'),
  roots: [
    path.resolve(__dirname),
  ],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleDirectories: ['node_modules', path.resolve(__dirname, '../../server/node_modules')],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    }],
  },
  globalSetup: path.resolve(__dirname, 'setup.ts'),
  globalTeardown: path.resolve(__dirname, 'teardown.ts'),
};
