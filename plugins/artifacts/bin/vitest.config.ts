// Vitest config for the btrmnt CLI. W2d writes the in-memory api stub and the
// end-to-end coverage of login + publish + promote against it.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
    // Many specs spawn the CLI via tsx (a transpile + load + spawn cycle)
    // 2-3 times sequentially. Under concurrent load on slower CI hardware
    // the default 5s timeout is too tight; 15s gives headroom without
    // hiding genuine hangs.
    testTimeout: 15_000,
  },
})
