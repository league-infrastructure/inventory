/**
 * Jest `setupFiles` entry — runs before the test framework is installed
 * for each test file, i.e. before that file's own top-of-file code
 * (including any `process.env.NODE_ENV = 'test'` line) ever executes.
 *
 * Strips real DigitalOcean Spaces credentials from the test process so
 * `ServiceRegistry` (server/src/services/service.registry.ts) can never
 * select `SpacesFileStorage` while running under jest — even when the
 * developer's shell has the full project `.env` sourced (common, since
 * token-auth suites need `SESSION_SECRET` from it).
 *
 * Follow-up fix for sprint 010 ticket 001: before this guard existed,
 * running the generated-file/label/export-list/scheduler test suites
 * with `.env` exported caused real uploads into the production Spaces
 * bucket under `generated-files/` (131 objects, since cleaned up).
 * The ticket's own acceptance criteria require that no test ever needs
 * or uses real Spaces credentials.
 *
 * This is layer 1 of two independent guards; layer 2 is the
 * `NODE_ENV === 'test'` check in `ServiceRegistry` itself, which still
 * holds even if a test file re-sets these vars on purpose (see
 * tests/server/services/service-registry-file-storage.test.ts).
 */
delete process.env.DO_SPACES_KEY;
delete process.env.DO_SPACES_SECRET;
