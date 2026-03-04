module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/logger.js',
    '!src/config/db.js',          // pool config, not business logic
    '!src/services/**',           // Salesforce/Zendesk need live creds
    '!src/middleware/audit.js',   // fire-and-forget, no exports to test
    '!src/routes/agents.js',      // depends on ZendeskService
    '!src/routes/billing.js',     // depends on SalesforceService
    '!src/routes/calls.js',       // depends on ZendeskService
    '!src/routes/claims.js',      // depends on SalesforceService
    '!src/routes/customers.js',   // depends on SalesforceService
    '!src/routes/password-reset.js', // depends on Resend email service
  ],
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 65, statements: 70 }
  },
  testTimeout: 15000,
  verbose: true,
};
