// Shared types for the btrmnt artifact platform API. Mirrors the schemas in
// `artifact-platform/docs/contracts.openapi.yaml`. Both the plugin's `bin/btrmnt`
// tool and the private backend consume these definitions. Any change here must
// also update the OpenAPI document in the same PR.

export type Role = 'tenant_admin' | 'tenant_user'
export type Env = 'test' | 'prod'
export type EnvScope = Env | 'both'

export interface Tenant {
  id: string
  slug: string
  name?: string | null
  created_at: string
  suspended_at?: string | null
}

export interface User {
  id: string
  email: string
  created_at: string
}

export interface Membership {
  user_id: string
  tenant_id: string
  tenant_slug: string
  role: Role
}

export interface ProjectEnvironment {
  project_id: string
  env: Env
  deployed_sha?: string | null
  deployed_at?: string | null
  cf_access_app_id?: string | null
  cf_access_policy_id?: string | null
  url: string
}

export interface Project {
  id: string
  tenant_id: string
  slug: string
  owner_user_id: string
  created_at: string
  environments: [ProjectEnvironment, ProjectEnvironment]
  /**
   * HTTPS URL of the project's bare git repo. Always returned on create + get.
   * The plugin uses this as the `btrmnt` remote URL. Authenticated via the
   * platform token through a GIT_ASKPASS helper.
   */
  git_remote_url: string
}

export interface Grant {
  project_id: string
  env: Env
  email: string
}

export interface SystemHealth {
  db: 'ok' | 'degraded' | 'down'
  efs: 'ok' | 'degraded' | 'down'
  tunnel: 'ok' | 'degraded' | 'down'
  cf_api: 'ok' | 'degraded' | 'down'
}

export interface ApiError {
  error: string
  workstream?: string
  details?: Record<string, unknown>
}

// Request bodies used by `bin/btrmnt` against the client `api`.

export interface CreateProjectRequest {
  slug: string
  initial_path?: string
}

export interface CreateGrantRequest {
  email: string
  env?: EnvScope
}

export interface CreateInviteRequest {
  email: string
  role?: Role
}

// admin-api request bodies.

export interface CreateTenantRequest {
  slug: string
  admin_email: string
}

export interface CreateTenantResponse {
  tenant: Tenant
  admin_user: User
}

export interface CreateInviteResponse {
  user: User
  membership: Membership
}
