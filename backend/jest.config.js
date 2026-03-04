module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/logger.js',
    '!src/services/**',   // Salesforce/Zendesk need live creds
  ],
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 60, statements: 70 }
  },
  setupFilesAfterFramework: [],
  testTimeout: 15000,
  verbose: true,
};
