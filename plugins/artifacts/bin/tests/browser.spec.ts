// Regression tests for the platform-specific argv we hand to the OS
// browser opener.
//
// The Windows case is the load-bearing one: an earlier version used
// `cmd /c start "" <url>`, and cmd.exe interpreted the `&` between
// `?cb=...` and `&state=...` as a command separator, truncating the
// URL. The api then received `/auth/start` with no `state`, redirected
// back with an empty state, and the loopback callback rejected the
// login as a state mismatch ("Sign-in failed").

import { describe, expect, it } from 'vitest'
import { resolveOpenBrowserCommand } from '../src/browser.js'

const URL_WITH_AMPERSAND =
  'https://api.btrmntlab.com/auth/start' +
  '?cb=http%3A%2F%2F127.0.0.1%3A52168%2Fcallback' +
  '&state=abc-DEF_123'

describe('resolveOpenBrowserCommand', () => {
  it('darwin uses `open` with the url as a single arg', () => {
    const r = resolveOpenBrowserCommand(URL_WITH_AMPERSAND, 'darwin')
    expect(r.cmd).toBe('open')
    expect(r.args).toEqual([URL_WITH_AMPERSAND])
  })

  it('linux uses `xdg-open` with the url as a single arg', () => {
    const r = resolveOpenBrowserCommand(URL_WITH_AMPERSAND, 'linux')
    expect(r.cmd).toBe('xdg-open')
    expect(r.args).toEqual([URL_WITH_AMPERSAND])
  })

  it('win32 uses powershell Start-Process (NOT cmd /c start)', () => {
    const r = resolveOpenBrowserCommand(URL_WITH_AMPERSAND, 'win32')
    // cmd.exe must not appear anywhere — it would parse `&` in the URL
    // as a command separator and chop off `&state=...`.
    expect(r.cmd).not.toBe('cmd')
    expect(r.cmd).toBe('powershell')
    expect(r.args).toContain('Start-Process')
    // The URL must pass through verbatim, including the `&` and the
    // state token after it. This is the actual regression guard.
    expect(r.args).toContain(URL_WITH_AMPERSAND)
    const passedUrl = r.args.find((a) => a.startsWith('https://')) ?? ''
    expect(passedUrl).toMatch(/&state=abc-DEF_123$/)
  })
})
