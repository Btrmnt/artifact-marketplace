// Cross-platform browser opener. Pure spawn so we don't pull in a
// dependency. macOS: `open`, Linux: `xdg-open`, Windows: `start`.
//
// The device-flow login emits the verification URL on stderr as JSON
// before calling this, so headless / sandbox / CI callers always have a
// machine-readable URL regardless of whether the shell-out worked. Opening
// the browser is best-effort UX on top of that contract.
//
// In tests we set BTRMNT_TEST_DISABLE_BROWSER=1 — we silently skip the
// shell-out so the suite doesn't actually pop a real browser window.

import { spawn } from 'node:child_process'

export function openBrowser(url: string): void {
  if (process.env.BTRMNT_TEST_DISABLE_BROWSER === '1') {
    return
  }
  const platform = process.platform
  let cmd: string
  let args: string[]
  if (platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else if (platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '""', url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }
  // Test seam: force the spawn target to a binary that doesn't exist so
  // the integration test can reproduce the Cowork/CI failure mode where
  // the platform opener is absent. Used by tests/login.spec.ts; ignored
  // outside test runs.
  if (process.env.BTRMNT_TEST_BROWSER_CMD) {
    cmd = process.env.BTRMNT_TEST_BROWSER_CMD
    args = [url]
  }
  // detached + ignore so the CLI doesn't block on the browser process.
  // Wrap the spawn itself — `child_process.spawn` can synchronously throw on
  // some platforms when the binary is missing — and attach an `error` listener
  // so an async ENOENT from `execvp` does not become an uncaught exception
  // that kills the CLI mid-login. In sandboxed Linux environments (Cowork,
  // CI runners) `xdg-open` is frequently absent; the device-flow URL is on
  // stderr already, so silently dropping the open is the right answer.
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
  } catch {
    // ignore — best-effort UX
  }
}
