import type { Config } from 'jest';
const config:Config={preset:'jest-preset-angular',testEnvironment:'jsdom',setupFilesAfterEnv:['<rootDir>/setup-jest.ts'],testMatch:['<rootDir>/projects/**/*.spec.ts'],moduleNameMapper:{'^@ledger/(.*)$':'<rootDir>/projects/ledger/$1/src/public-api.ts'}};
export default config;
