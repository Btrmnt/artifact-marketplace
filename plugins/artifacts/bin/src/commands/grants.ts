// `btrmnt grant`, `btrmnt revoke`, `btrmnt invite`, `btrmnt grants`.

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { simpleGit } from 'simple-git'

import { ApiClient } from '../api.js'
import { resolveApiEndpoint, resolveCwd } from '../config.js'
import { readCredentials } from '../credentials.js'
import { writeStdout } from '../output.js'
import { slugFromRemote } from './publish-promote.js'
import type { EnvScope, Role } from '@btrmnt/artifact-types'

// Minimal sanity check: rejects empty strings and anything with characters
// that would clearly mangle a URL path. We deliberately don't try to be
// fully RFC 5322 compliant — the server is the source of truth, this is
// just to fail fast on obvious garbage before sending the request.
const EMAIL_BASIC_RE = /^[^\s/?#@]+@[^\s/?#@]+\.[^\s/?#@]+$/

function assertEmail(email: string): void {
  if (!EMAIL_BASIC_RE.test(email)) {
    throw new Error(`invalid email ${JSON.stringify(email)}`)
  }
}

async function resolveSlug(explicit?: string): Promise<string> {
  if (explicit && explicit.trim().length > 0) return explicit
  const cwd = resolveCwd()
  if (!existsSync(resolve(cwd, '.git'))) {
    throw new Error(
      `no slug provided and CWD ${cwd} is not a git repo with a btrmnt remote`,
    )
  }
  const git = simpleGit(cwd)
  const remotes = await git.getRemotes(true)
  const btrmnt = remotes.find((r) => r.name === 'btrmnt')
  if (!btrmnt) {
    throw new Error('no `btrmnt` remote in CWD; provide an explicit slug argument')
  }
  const slug = slugFromRemote(btrmnt.refs.push)
  if (!slug) throw new Error(`could not parse a slug from ${btrmnt.refs.push}`)
  return slug
}

export async function listGrants(args: {
  slug?: string
  apiEndpoint?: string
}): Promise<void> {
  const slug = await resolveSlug(args.slug)
  const creds = readCredentials()
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint()
  const client = new ApiClient(endpoint, creds.token)
  const grants = await client.listGrants(slug)
  // Group flat (email, env) rows into one entry per viewer. We preserve the
  // order rows arrive in (server returns them sorted by email asc) so output
  // is stable across runs. Within a viewer, envs are sorted test-before-prod
  // to match how grant/revoke describe scopes elsewhere in the CLI.
  const order: string[] = []
  const byEmail = new Map<string, Set<'test' | 'prod'>>()
  for (const g of grants) {
    if (!byEmail.has(g.email)) {
      byEmail.set(g.email, new Set())
      order.push(g.email)
    }
    byEmail.get(g.email)!.add(g.env)
  }
  const envOrder = (e: 'test' | 'prod') => (e === 'test' ? 0 : 1)
  const viewers = order.map((email) => ({
    email,
    envs: Array.from(byEmail.get(email)!).sort((a, b) => envOrder(a) - envOrder(b)),
  }))
  writeStdout({ slug, viewers })
}

export async function grant(args: {
  email: string
  slug?: string
  env: EnvScope
  apiEndpoint?: string
}): Promise<void> {
  assertEmail(args.email)
  const slug = await resolveSlug(args.slug)
  const creds = readCredentials()
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint()
  const client = new ApiClient(endpoint, creds.token)
  const grants = await client.grant(slug, { email: args.email, env: args.env })
  writeStdout({ ok: true, slug, grants })
}

export async function revoke(args: {
  email: string
  slug?: string
  env: EnvScope
  apiEndpoint?: string
}): Promise<void> {
  assertEmail(args.email)
  const slug = await resolveSlug(args.slug)
  const creds = readCredentials()
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint()
  const client = new ApiClient(endpoint, creds.token)
  await client.revoke(slug, args.email, args.env)
  writeStdout({ ok: true, slug, email: args.email, env: args.env })
}

export async function invite(args: {
  email: string
  role: Role
  apiEndpoint?: string
}): Promise<void> {
  assertEmail(args.email)
  const creds = readCredentials()
  const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint()
  const client = new ApiClient(endpoint, creds.token)
  const result = await client.invite({ email: args.email, role: args.role })
  // No token to deliver — CF Access proves the email at next login.
  writeStdout({
    ...result,
    message: `Invited ${result.user.email}. Tell them to install the plugin and run /artifacts to sign in.`,
  })
}
