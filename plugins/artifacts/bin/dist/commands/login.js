// `btrmnt login` — CF Access login dance.
//
//   1. Generate a 32-byte random `state` token (base64url).
//   2. Open a local HTTP listener on 127.0.0.1:<random ephemeral>.
//   3. Open the browser to <api>/auth/start?cb=http://127.0.0.1:<port>/callback&state=<state>.
//      The api redirects through CF Access SSO, then redirects back to <cb>
//      with `?token=<raw-cf-jwt>&state=<state>`. CF stamps the verified JWT
//      on the request before the api sees it; we trust the api to echo
//      our `state` back unchanged.
//   4. Listen for GET /callback?token=...&state=... — reject any callback
//      whose `state` doesn't match the one we generated. This defends
//      against any process on the loopback (a malicious tab, a port scanner)
//      that hits the listener with a forged token while a login is in
//      flight.
//   5. Decode the JWT's `exp` claim to populate `expires_at` (best effort —
//      if decoding fails we just store `null`).
//   6. Persist {api_endpoint, token, expires_at} to credentials file (0600).
//   7. Print success JSON, exit 0.
//
// Timeout: 5 minutes by default (configurable via --timeout-ms for tests).
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { openBrowser } from '../browser.js';
import { resolveApiEndpoint } from '../config.js';
import { writeCredentials } from '../credentials.js';
import { writeStdout } from '../output.js';
const SUCCESS_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>btrmnt — authenticated</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:6rem auto;text-align:center}</style>
</head><body>
<h1>Authenticated</h1>
<p>You can close this tab and return to Claude Code.</p>
<script>try{window.close()}catch(e){}</script>
</body></html>
`;
const FAILURE_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>btrmnt — error</title></head>
<body><h1>Sign-in failed</h1><p>Return to Claude Code; the plugin will report the error.</p></body></html>
`;
/**
 * Best-effort decode of a JWT's `exp` claim into an ISO timestamp. Returns
 * `null` if the token isn't a parseable JWT or has no numeric `exp`. We
 * never throw — login should succeed even if the JWT shape is unexpected.
 */
export function expiresAtFromJwt(token) {
    const parts = token.split('.');
    if (parts.length < 2)
        return null;
    try {
        const payload = parts[1];
        // base64url -> base64
        const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
        const json = Buffer.from(b64 + pad, 'base64').toString('utf-8');
        const claims = JSON.parse(json);
        if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp))
            return null;
        return new Date(claims.exp * 1000).toISOString();
    }
    catch {
        return null;
    }
}
/** Constant-time string compare; false on length mismatch. */
function safeEqual(a, b) {
    const ab = Buffer.from(a, 'utf-8');
    const bb = Buffer.from(b, 'utf-8');
    if (ab.length !== bb.length)
        return false;
    return timingSafeEqual(ab, bb);
}
export async function login(opts) {
    const apiEndpoint = resolveApiEndpoint(opts.apiEndpoint);
    const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
    // 32 bytes = 256 bits of entropy; base64url to keep it URL-safe without
    // further encoding. Generated once per login attempt.
    const state = randomBytes(32).toString('base64url');
    let server = null;
    let timer = null;
    try {
        const tokenPromise = new Promise((resolve, reject) => {
            server = createServer((req, res) => {
                try {
                    if (!req.url || !req.url.startsWith('/callback')) {
                        res.statusCode = 404;
                        res.end();
                        return;
                    }
                    const u = new URL(req.url, 'http://127.0.0.1');
                    const token = u.searchParams.get('token');
                    const echoedState = u.searchParams.get('state');
                    if (!token) {
                        res.statusCode = 400;
                        res.setHeader('content-type', 'text/html; charset=utf-8');
                        res.end(FAILURE_PAGE);
                        reject(new Error('callback missing token query param'));
                        return;
                    }
                    if (!echoedState || !safeEqual(echoedState, state)) {
                        // Could be a CSRF attempt, a race with a stale browser tab, or
                        // the api dropping the state — never silently accept the token.
                        res.statusCode = 400;
                        res.setHeader('content-type', 'text/html; charset=utf-8');
                        res.end(FAILURE_PAGE);
                        reject(new Error('callback state mismatch — refusing to store token'));
                        return;
                    }
                    res.statusCode = 200;
                    res.setHeader('content-type', 'text/html; charset=utf-8');
                    res.end(SUCCESS_PAGE);
                    resolve(token);
                }
                catch (err) {
                    res.statusCode = 500;
                    res.end(FAILURE_PAGE);
                    reject(err);
                }
            });
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address();
                const callback = `http://127.0.0.1:${addr.port}/callback`;
                const startUrl = `${apiEndpoint}/auth/start` +
                    `?cb=${encodeURIComponent(callback)}` +
                    `&state=${encodeURIComponent(state)}`;
                openBrowser(startUrl);
            });
            timer = setTimeout(() => {
                reject(new Error('login timed out waiting for callback'));
            }, timeoutMs);
        });
        const token = await tokenPromise;
        const credsPath = writeCredentials({
            api_endpoint: apiEndpoint,
            token,
            expires_at: expiresAtFromJwt(token),
        });
        writeStdout({ ok: true, api_endpoint: apiEndpoint, credentials_path: credsPath });
    }
    finally {
        if (timer)
            clearTimeout(timer);
        if (server)
            await new Promise((r) => server.close(() => r()));
    }
}
//# sourceMappingURL=login.js.map