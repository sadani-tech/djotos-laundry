/** Dua project: unit (cepat, tanpa DB) dan e2e (Postgres + Redis sungguhan, database `djotos_test`). */
const base = { preset: 'ts-jest', testEnvironment: 'node', rootDir: '.' };
module.exports = {
  testTimeout: 30000,
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      setupFiles: ['<rootDir>/test/setup-env.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
    },
  ],
};
