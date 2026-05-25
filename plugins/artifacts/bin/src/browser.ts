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
  // detached + ignore so the CLI doesn't block on the browser process.
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
  child.unref()
}
