import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    // The plugin-validate test can shell out to the host `claude` CLI which is
    // slow on first invocation; everything else is fast.
    testTimeout: 30_000,
  },
})
