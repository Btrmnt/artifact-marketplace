// `btrmnt whoami` — reads stored creds, calls GET /v1/users/me, prints
// {email, role, tenant, expires_at}.
//
// "role" + "tenant" come from the FIRST membership in the response. In the
// current product model a user has exactly one membership (one tenant) until
// multi-tenant support lands. If the user has zero memberships we still print
// a result but with role/tenant as nulls so the JSON shape stays stable.

import { ApiClient } from '../api.js'
import { resolveApiEndpoint } from '../config.js'
import { readCredentials } from '../credentials.js'
import { writeStdout } from '../output.js'

export interface WhoamiOptions {
  apiEndpoint?: string
}

export async function whoami(opts: WhoamiOptions): Promise<void> {
  const creds = readCredentials()
  // The credential's api_endpoint wins over the flag/env if it's set, but the
  // flag still overrides for ops debugging. (Resolution: flag > creds > env > default.)
  const endpoint = opts.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint()
  const client = new ApiClient(endpoint, creds.token)
  const { user, memberships } = await client.whoami()
  const first = memberships[0]
  writeStdout({
    email: user.email,
    role: first?.role ?? null,
    tenant: first?.tenant_slug ?? null,
    expires_at: creds.expires_at,
  })
}
