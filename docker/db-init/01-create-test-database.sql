-- Runs once, the first time the data volume is created. Provides the dedicated database used by
-- `pnpm test:integration` and `pnpm test:e2e`, so tests never touch development data.
CREATE DATABASE smartpack_test OWNER smartpack;
