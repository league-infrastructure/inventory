const path = require('path');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, '../../server'),
  roots: [
    '<rootDir>/src',
    path.resolve(__dirname),
  ],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'inventory-load\\.test\\.ts'],
  // Strips DO_SPACES_KEY/DO_SPACES_SECRET before every test file loads,
  // so ServiceRegistry can never select real Spaces storage under jest —
  // see jest.setup-env.js for why.
  setupFiles: [path.resolve(__dirname, 'jest.setup-env.js')],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Resolve imports from server/node_modules (where deps are installed)
  moduleDirectories: ['node_modules', path.resolve(__dirname, '../../server/node_modules')],
  moduleNameMapper: {
    '^@prisma/client$': path.resolve(__dirname, '../../server/node_modules/@prisma/client'),
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    }],
  },
  collectCoverageFrom: [
    'src/services/**/*.service.ts',
  ],
  coverageDirectory: path.resolve(__dirname, '../../coverage'),
  coverageThreshold: {
    'src/services/': {
      lines: 85,
      branches: 70,
      functions: 85,
    },
  },
};
