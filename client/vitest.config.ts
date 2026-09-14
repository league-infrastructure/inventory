import { defineConfig } from 'vitest/config';

// Minimal config for pure-logic unit tests (e.g. src/lib/*.test.ts). No
// jsdom/happy-dom environment or React plugin is configured — there is no
// component-rendering test harness (jsdom, @testing-library/react) set up
// in this project yet. Add that separately if a future ticket needs to
// render components rather than test extracted pure functions.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
