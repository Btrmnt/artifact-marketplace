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

/**
 * Pick the (cmd, args) pair used to hand a URL off to the OS default
 * browser. Exported so the platform branching is unit-testable without
 * actually spawning a child process.
 *
 * Windows note: we deliberately AVOID `cmd /c start "" <url>`. cmd.exe
 * treats `&` as a command separator and will truncate the URL at the
 * first `&` (e.g. `?cb=...&state=...` → loses `state=...`), which
 * silently breaks the OAuth callback's CSRF check. Using PowerShell's
 * `Start-Process` sidesteps cmd's metacharacter parsing entirely.
 */
export function resolveOpenBrowserCommand(
  url: string,
  platform: NodeJS.Platform,
): { cmd: string; args: string[] } {
  if (platform === 'darwin') return { cmd: 'open', args: [url] }
  if (platform === 'win32') {
    return {
      cmd: 'powershell',
      args: ['-NoProfile', '-Command', 'Start-Process', url],
    }
  }
  return { cmd: 'xdg-open', args: [url] }
}

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
  const { cmd, args } = resolveOpenBrowserCommand(url, process.platform)
  // detached + ignore so the CLI doesn't block on the browser process.
  // Wrap the spawn itself — `child_process.spawn` can synchronously throw on
  // some platforms when the binary is missing — and attach an `error` listener
  // so an async ENOENT from `execvp` does not become an uncaught exception
  // that kills the CLI mid-login. In sandboxed Linux environments (CI
  // runners, minimal Docker images) `xdg-open` is frequently absent; the
  // auth URL is on stderr already, so silently dropping the open is the
  // right answer.
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
  } catch {
    // ignore — best-effort UX
  }
}
