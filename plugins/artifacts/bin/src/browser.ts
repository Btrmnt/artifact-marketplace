// Cross-platform browser opener. Pure spawn so we don't pull in a
// dependency. macOS: `open`, Linux: `xdg-open`, Windows: `start`.
//
// We ALWAYS emit a JSON status line on stderr announcing the auth URL
// before attempting to open the browser. This means callers that can't
// see a browser window (Claude Code in a headless / remote shell, CI,
// SSH sessions) can still surface the URL for the user to paste.
//
// In tests we set BTRMNT_TEST_DISABLE_BROWSER=1 — we ALSO print the
// legacy raw `AUTH_URL=<url>` stderr line so existing test harnesses
// keep working, and we skip actually shelling out.

import { spawn } from 'node:child_process'
import { writeStderrJson, writeStderrRaw } from './output.js'

export function openBrowser(url: string): void {
  // Always announce the URL on stderr as JSON so non-interactive callers
  // (Claude Code, CI, SSH) can surface it. Production code reads this
  // as a progress line, not as an error — exit code is the only signal
  // that matters for success/failure.
  writeStderrJson({
    status: 'awaiting_callback',
    auth_url: url,
    hint: 'If your browser did not open automatically, visit this URL to complete sign-in.',
  })
  if (process.env.BTRMNT_TEST_DISABLE_BROWSER === '1') {
    writeStderrRaw(`AUTH_URL=${url}`)
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
