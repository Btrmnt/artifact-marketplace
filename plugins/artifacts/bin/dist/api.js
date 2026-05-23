// HTTP client for the btrmnt platform api. Uses Node's built-in fetch.
//
// Authentication is Cloudflare Access: the CLI stores the raw CF Access JWT
// (captured during `btrmnt login`) and sends it back two ways on every
// request — `CF_Authorization` cookie AND `Cf-Access-Jwt-Assertion` header.
//
// Both are needed because the platform's CF Access apps run in mixed modes:
//   - The /auth/* app still enforces CF Access at the edge. CF reads the
//     cookie, validates it, and stamps the verified JWT as the
//     `Cf-Access-Jwt-Assertion` header on the request before forwarding.
//     The header WE send gets overwritten — that's fine.
//   - The /v1/* and git apps run in `bypass` mode. CF doesn't validate or
//     stamp anything — the request passes through unchanged. The origin
//     reads the assertion header WE sent and verifies the JWT itself
//     against the CF JWKS.
//
// Sending both means the same client works on either mode without knowing
// which apps are gated at the edge vs bypassed.
//
// All requests carry:
//   Cookie:                  CF_Authorization=<cf-jwt>
//   Cf-Access-Jwt-Assertion: <cf-jwt>
//   User-Agent:              btrmnt-plugin/<version>
//
// On 401 we throw an `ApiError` whose message tells the user to `btrmnt
// login` again; the CLI's top-level error handler surfaces that as JSON on
// stderr. Other non-2xx statuses surface the parsed body where available.
import { validateApiEndpoint } from './config.js';
// We can't easily read package.json from compiled ESM without import
// assertions, so hardcode the user-agent version (it tracks the plugin
// release, not semver). Bump on each meaningful client change.
//
// 0.1.0-security: introduces login state CSRF, secret-guard, endpoint
// allowlist, env-driven git push auth, atomic credentials write.
export const USER_AGENT = 'btrmnt-plugin/0.1.0-security';
export class ApiError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'ApiError';
    }
}
export class ApiClient {
    token;
    endpoint;
    constructor(endpoint, token) {
        this.token = token;
        // Validate before any request goes out. Catches the case where a
        // malicious BTRMNT_API_ENDPOINT or stored credentials file would point
        // the CLI (and the JWT it sends) at an attacker host.
        this.endpoint = validateApiEndpoint(endpoint);
    }
    async request(method, path, body) {
        const headers = {
            cookie: `CF_Authorization=${this.token}`,
            'cf-access-jwt-assertion': this.token,
            'user-agent': USER_AGENT,
            accept: 'application/json',
        };
        if (body !== undefined)
            headers['content-type'] = 'application/json';
        const init = { method, headers };
        if (body !== undefined)
            init.body = JSON.stringify(body);
        const resp = await fetch(`${this.endpoint}${path}`, init);
        const text = await resp.text();
        let parsed = undefined;
        if (text.length > 0) {
            try {
                parsed = JSON.parse(text);
            }
            catch {
                parsed = text;
            }
        }
        if (resp.status === 401) {
            // CF Access rejected the cookie (expired / revoked / never valid).
            // Surface a clear next-step instead of dumping the raw body.
            throw new ApiError('authentication failed (401); run `btrmnt login` to re-authenticate', resp.status, parsed);
        }
        if (resp.status < 200 || resp.status >= 300) {
            throw new ApiError(`${method} ${path} -> ${resp.status}`, resp.status, parsed);
        }
        return parsed;
    }
    whoami() {
        return this.request('GET', '/v1/users/me');
    }
    listProjects() {
        return this.request('GET', '/v1/projects');
    }
    createProject(req) {
        return this.request('POST', '/v1/projects', req);
    }
    deleteProject(slug) {
        return this.request('DELETE', `/v1/projects/${encodeURIComponent(slug)}`).then(() => undefined);
    }
    promote(slug) {
        return this.request('POST', `/v1/projects/${encodeURIComponent(slug)}/promote`, {});
    }
    rollback(slug, sha) {
        return this.request('POST', `/v1/projects/${encodeURIComponent(slug)}/rollback`, { sha });
    }
    grant(slug, req) {
        // OpenAPI default for `env` is "both"; send it explicitly so the api never
        // has to guess.
        const body = { email: req.email, env: req.env ?? 'both' };
        return this.request('POST', `/v1/projects/${encodeURIComponent(slug)}/grants`, body);
    }
    revoke(slug, email, env) {
        // URL-encode the email even though `@` is a valid path-segment
        // character per RFC 3986. Leaving `@` raw was tolerable, but leaving
        // `/`, `?`, or `#` raw would let a malformed email smuggle in an
        // extra path segment or query parameter. encoding everything is the
        // safe default; the server should decode path segments anyway.
        const path = `/v1/projects/${encodeURIComponent(slug)}/grants/${encodeURIComponent(email)}` +
            `?env=${encodeURIComponent(env)}`;
        return this.request('DELETE', path).then(() => undefined);
    }
    invite(req) {
        return this.request('POST', '/v1/invites', req);
    }
}
//# sourceMappingURL=api.js.map