module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    '!**/*.test.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: [],
  testTimeout: 10000,
  verbose: true,
  moduleFileExtensions: ['js', 'json'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  testPathIgnorePatterns: ['/node_modules/', '/public/'],
  collectCoverageFrom: [
    'services/**/*.js',
    '!**/node_modules/**',
    '!**/test/**'
  ]
};
