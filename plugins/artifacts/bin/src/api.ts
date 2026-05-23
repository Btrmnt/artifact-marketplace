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

import type {
  CreateGrantRequest,
  CreateInviteRequest,
  CreateInviteResponse,
  CreateProjectRequest,
  EnvScope,
  Grant,
  Membership,
  Project,
  ProjectEnvironment,
  User,
} from '@btrmnt/artifact-types'

import { validateApiEndpoint } from './config.js'

// We can't easily read package.json from compiled ESM without import
// assertions, so hardcode the user-agent version (it tracks the plugin
// release, not semver). Bump on each meaningful client change.
//
// 0.1.0-security: introduces login state CSRF, secret-guard, endpoint
// allowlist, env-driven git push auth, atomic credentials write.
export const USER_AGENT = 'btrmnt-plugin/0.1.0-security'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ApiClient {
  private readonly endpoint: string
  constructor(endpoint: string, private readonly token: string) {
    // Validate before any request goes out. Catches the case where a
    // malicious BTRMNT_API_ENDPOINT or stored credentials file would point
    // the CLI (and the JWT it sends) at an attacker host.
    this.endpoint = validateApiEndpoint(endpoint)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T | undefined> {
    const headers: Record<string, string> = {
      cookie: `CF_Authorization=${this.token}`,
      'cf-access-jwt-assertion': this.token,
      'user-agent': USER_AGENT,
      accept: 'application/json',
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const init: RequestInit = { method, headers }
    if (body !== undefined) init.body = JSON.stringify(body)
    const resp = await fetch(`${this.endpoint}${path}`, init)
    const text = await resp.text()
    let parsed: unknown = undefined
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = text
      }
    }
    if (resp.status === 401) {
      // CF Access rejected the cookie (expired / revoked / never valid).
      // Surface a clear next-step instead of dumping the raw body.
      throw new ApiError(
        'authentication failed (401); run `btrmnt login` to re-authenticate',
        resp.status,
        parsed,
      )
    }
    if (resp.status < 200 || resp.status >= 300) {
      throw new ApiError(
        `${method} ${path} -> ${resp.status}`,
        resp.status,
        parsed,
      )
    }
    return parsed as T | undefined
  }

  whoami(): Promise<{ user: User; memberships: Membership[] }> {
    return this.request<{ user: User; memberships: Membership[] }>(
      'GET',
      '/v1/users/me',
    ) as Promise<{ user: User; memberships: Membership[] }>
  }

  listProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/v1/projects') as Promise<Project[]>
  }

  createProject(req: CreateProjectRequest): Promise<Project> {
    return this.request<Project>('POST', '/v1/projects', req) as Promise<Project>
  }

  deleteProject(slug: string): Promise<void> {
    return this.request<void>('DELETE', `/v1/projects/${encodeURIComponent(slug)}`).then(
      () => undefined,
    )
  }

  promote(slug: string): Promise<ProjectEnvironment> {
    return this.request<ProjectEnvironment>(
      'POST',
      `/v1/projects/${encodeURIComponent(slug)}/promote`,
      {},
    ) as Promise<ProjectEnvironment>
  }

  rollback(slug: string, sha: string): Promise<ProjectEnvironment> {
    return this.request<ProjectEnvironment>(
      'POST',
      `/v1/projects/${encodeURIComponent(slug)}/rollback`,
      { sha },
    ) as Promise<ProjectEnvironment>
  }

  listGrants(slug: string): Promise<Grant[]> {
    return this.request<Grant[]>(
      'GET',
      `/v1/projects/${encodeURIComponent(slug)}/grants`,
    ) as Promise<Grant[]>
  }

  grant(slug: string, req: CreateGrantRequest): Promise<Grant[]> {
    // OpenAPI default for `env` is "both"; send it explicitly so the api never
    // has to guess.
    const body: CreateGrantRequest = { email: req.email, env: req.env ?? ('both' as EnvScope) }
    return this.request<Grant[]>(
      'POST',
      `/v1/projects/${encodeURIComponent(slug)}/grants`,
      body,
    ) as Promise<Grant[]>
  }

  revoke(slug: string, email: string, env: EnvScope): Promise<void> {
    // URL-encode the email even though `@` is a valid path-segment
    // character per RFC 3986. Leaving `@` raw was tolerable, but leaving
    // `/`, `?`, or `#` raw would let a malformed email smuggle in an
    // extra path segment or query parameter. encoding everything is the
    // safe default; the server should decode path segments anyway.
    const path =
      `/v1/projects/${encodeURIComponent(slug)}/grants/${encodeURIComponent(email)}` +
      `?env=${encodeURIComponent(env)}`
    return this.request<void>('DELETE', path).then(() => undefined)
  }

  invite(req: CreateInviteRequest): Promise<CreateInviteResponse> {
    return this.request<CreateInviteResponse>(
      'POST',
      '/v1/invites',
      req,
    ) as Promise<CreateInviteResponse>
  }
}
