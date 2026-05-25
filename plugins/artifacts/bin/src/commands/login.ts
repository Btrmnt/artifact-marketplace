// `btrmnt login` — OAuth 2.0 Device Authorization Grant (RFC 8628).
//
//   1. POST /auth/device. The api returns:
//        { device_code, user_code, verification_uri, verification_uri_complete,
//          expires_in, interval }
//      - device_code: long opaque secret. The CLI keeps it; it is the bearer
//        credential we redeem at /auth/token.
//      - user_code: short XXXX-XXXX code the user pastes into the browser.
//      - verification_uri / _complete: where the user goes to approve.
//
//   2. Emit a JSON status line on stderr so headless callers (Claude Code, CI
//      runners, SSH sessions) see the URL + user_code immediately. Best-
//      effort open the system browser in case the user is local.
//
//   3. Poll POST /auth/token { device_code } every `interval` seconds:
//        - 200 { token, expires_at, api_endpoint } -> persist, success.
//        - 400 { error: "authorization_pending" }  -> wait, poll again.
//        - 400 { error: "slow_down", interval }    -> bump interval, poll.
//        - 400 { error: "expired_token" | "access_denied" | ... } -> fail.
//      Total deadline is `expires_in` from step 1 (10 min by default).
//
//   4. Decode the JWT's `exp` claim into ISO-8601 for `expires_at`; persist
//      `{ api_endpoint, token, expires_at }` to ~/.btrmnt/credentials.json
//      mode 0600. Emit success JSON on stdout, exit 0.
//
// Replaces the old loopback (/auth/start) flow. That flow required the CLI
// to bind 127.0.0.1:<random>, which fails in any environment where the user
// isn't physically at the same machine as the browser that does the SSO.
// Device flow needs only outbound HTTPS, so it works everywhere — at the
// cost of one extra screen for the user.

import { openBrowser } from '../browser.js'
import { resolveApiEndpoint } from '../config.js'
import { writeCredentials } from '../credentials.js'
import { writeStderrJson, writeStdout } from '../output.js'

export interface LoginOptions {
  apiEndpoint?: string
  /**
   * Override the total deadline. Defaults to `expires_in` from the server,
   * which we treat as authoritative — this option exists for tests that
   * want a short deadline without colluding with the server.
   */
  timeoutMs?: number
  /**
   * Override the polling interval (ms). Defaults to `interval * 1000` from
   * the server. Tests pass a tiny value (50ms) so the spec runs quickly.
   */
  pollIntervalMs?: number
}

interface DeviceInit {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

interface TokenSuccess {
  token: string
  expires_at: string
  api_endpoint: string
}

interface TokenError {
  error: string
  error_description?: string
  interval?: number
}

/**
 * Best-effort decode of a JWT's `exp` claim into an ISO timestamp. Returns
 * `null` if the token isn't a parseable JWT or has no numeric `exp`. We
 * never throw — login should succeed even if the JWT shape is unexpected.
 * (Same logic as the old loopback flow; the JWT itself is identical.)
 */
export function expiresAtFromJwt(token: string): string | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]!
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const json = Buffer.from(b64 + pad, 'base64').toString('utf-8')
    const claims = JSON.parse(json) as { exp?: number }
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) return null
    return new Date(claims.exp * 1000).toISOString()
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function login(opts: LoginOptions): Promise<void> {
  const apiEndpoint = resolveApiEndpoint(opts.apiEndpoint)

  // Step 1: mint device + user codes.
  const startRes = await fetch(`${apiEndpoint}/auth/device`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  if (!startRes.ok) {
    const text = await startRes.text().catch(() => '')
    throw new Error(
      `failed to start device authorization (HTTP ${startRes.status}): ${text.slice(0, 200)}`,
    )
  }
  const init = (await startRes.json()) as DeviceInit
  if (!init.device_code || !init.user_code) {
    throw new Error('device authorization response missing device_code or user_code')
  }

  // Step 2: surface the URL + code to the caller. Stderr keeps it out of
  // the success-JSON contract on stdout; the JSON shape is stable so
  // Claude Code / scripts can parse it.
  writeStderrJson({
    status: 'awaiting_authorization',
    verification_uri: init.verification_uri,
    verification_uri_complete: init.verification_uri_complete,
    user_code: init.user_code,
    expires_in: init.expires_in,
    interval: init.interval,
    hint:
      `Open ${init.verification_uri_complete} in your browser to authorise this device. ` +
      `If asked for a code, enter ${init.user_code}.`,
  })

  // Try to open the system browser too. This is best-effort — in any
  // headless context the caller is already reading the URL from stderr.
  openBrowser(init.verification_uri_complete)

  // Step 3: poll until success / failure / deadline.
  const pollIntervalMs = opts.pollIntervalMs ?? init.interval * 1000
  const totalDeadlineMs = opts.timeoutMs ?? init.expires_in * 1000
  const deadline = Date.now() + totalDeadlineMs
  let currentInterval = pollIntervalMs

  // First wait — RFC 8628 says the client SHOULD wait `interval` before
  // the first poll. We honour that; if the user is fast it just means one
  // extra round-trip with `authorization_pending`.
  while (Date.now() < deadline) {
    await sleep(currentInterval)
    const tokenRes = await fetch(`${apiEndpoint}/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: init.device_code }),
    })
    if (tokenRes.status === 200) {
      const ok = (await tokenRes.json()) as TokenSuccess
      if (!ok.token) {
        throw new Error('device authorization returned success with no token')
      }
      const credsPath = writeCredentials({
        api_endpoint: apiEndpoint,
        token: ok.token,
        // The dev sentinel `dev:<email>` is not a real JWT, so don't even
        // try to decode it. expiresAtFromJwt() returns null for malformed
        // input which is the right answer.
        expires_at: expiresAtFromJwt(ok.token),
      })
      writeStdout({ ok: true, api_endpoint: apiEndpoint, credentials_path: credsPath })
      return
    }
    // Non-200 -> read the structured error.
    let err: TokenError = { error: 'unknown' }
    try {
      err = (await tokenRes.json()) as TokenError
    } catch {
      // Server returned a non-JSON body. Treat as fatal — we have no idea
      // what's going on, retrying won't help.
      throw new Error(`unexpected /auth/token response (HTTP ${tokenRes.status})`)
    }
    if (err.error === 'authorization_pending') {
      continue
    }
    if (err.error === 'slow_down') {
      // Server-advertised new interval, or fall back to bumping by 5s
      // (the spec's recommended minimum bump).
      currentInterval =
        typeof err.interval === 'number' && err.interval > 0
          ? err.interval * 1000
          : currentInterval + 5000
      continue
    }
    // Any other error code is terminal (expired_token, access_denied,
    // invalid_request, or anything new the server adds).
    throw new Error(`device authorization failed: ${err.error}`)
  }
  throw new Error('device authorization timed out — re-run `btrmnt login` to start over')
}
