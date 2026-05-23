// `btrmnt project new|list|delete`
//
// project new:
//   1. Validate slug locally (server validates too, but fail fast).
//   2. POST /v1/projects {slug}.
//   3. cd into --path (or CWD).
//   4. If not a git repo: git init.
//   5. Ensure user.email / user.name set on the repo (use the platform user's
//      email; we read it back via whoami).
//   6. git remote add/set-url btrmnt <git_remote_url>.
//   7. If working tree has untracked files, stage them.
//   8. If there are staged/unstaged changes, commit "Initial commit".
//   9. Push to btrmnt main, injecting the CF Access JWT cookie via
//      `http.extraHeader` so CF Access can authenticate the push.
//   10. Print {project, test_url}.
//
// project list: GET /v1/projects.
// project delete <slug> --yes: DELETE /v1/projects/<slug>.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import { ApiClient } from '../api.js';
import { resolveApiEndpoint, resolveCwd } from '../config.js';
import { readCredentials } from '../credentials.js';
import { authenticatedPush } from '../git-auth.js';
import { writeStdout } from '../output.js';
import { writeStderrJson } from '../output.js';
import { assertNoSecrets, candidatePathsFromGit, DEFAULT_GITIGNORE, SecretFoundError, } from '../secret-guard.js';
const SLUG_RE = /^[a-z][a-z0-9-]{0,40}[a-z0-9]$/;
export async function projectNew(args) {
    if (!SLUG_RE.test(args.slug)) {
        throw new Error(`invalid slug ${JSON.stringify(args.slug)}: must match ${SLUG_RE.source}`);
    }
    const creds = readCredentials();
    const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
    const client = new ApiClient(endpoint, creds.token);
    const project = await client.createProject({ slug: args.slug });
    const projectDir = resolve(args.path ?? resolveCwd());
    mkdirSync(projectDir, { recursive: true });
    const git = simpleGit(projectDir);
    // Initialize repo if needed.
    if (!existsSync(resolve(projectDir, '.git'))) {
        await git.init();
    }
    // Scaffold a sensible .gitignore BEFORE the first `git.add`, so the
    // initial commit can't accidentally pick up node_modules, .env, etc.
    const gitignorePath = resolve(projectDir, '.gitignore');
    if (!existsSync(gitignorePath)) {
        writeFileSync(gitignorePath, DEFAULT_GITIGNORE);
    }
    // Pre-flight secret scan. Stops obvious secrets from being pushed to the
    // hosted git remote. We ask git for the set of paths that would be
    // staged (tracked + untracked-and-not-gitignored) so a legitimately
    // gitignored `.env` doesn't trip the guard.
    const candidates = await candidatePathsFromGit(git);
    try {
        assertNoSecrets(projectDir, candidates);
    }
    catch (err) {
        if (err instanceof SecretFoundError && args.allowSecrets) {
            writeStderrJson({
                warning: 'secret-guard bypassed via --allow-secrets',
                matches: err.matches,
            });
        }
        else {
            throw err;
        }
    }
    // Make sure user.email / user.name are set (required for committing). We
    // try the platform identity first so the audit log is meaningful, but fall
    // back to a synthetic value if the api doesn't expose /v1/users/me yet.
    let identityEmail = 'btrmnt@local';
    try {
        const me = await client.whoami();
        if (me?.user?.email)
            identityEmail = me.user.email;
    }
    catch {
        // best-effort
    }
    try {
        await git.addConfig('user.email', identityEmail);
    }
    catch {
        // ignore — if it's already set globally we're fine
    }
    try {
        await git.addConfig('user.name', identityEmail);
    }
    catch {
        // ignore
    }
    // Add/update the `btrmnt` remote.
    if (!project.git_remote_url) {
        throw new Error('api did not return git_remote_url; cannot configure remote');
    }
    const remotes = await git.getRemotes(true);
    const existing = remotes.find((r) => r.name === 'btrmnt');
    if (existing) {
        await git.remote(['set-url', 'btrmnt', project.git_remote_url]);
    }
    else {
        await git.addRemote('btrmnt', project.git_remote_url);
    }
    // Stage + commit if there's anything to commit.
    await git.add('.');
    const status = await git.status();
    const hasInitialCommit = await git
        .raw(['rev-parse', '--verify', 'HEAD'])
        .then(() => true)
        .catch(() => false);
    if (status.staged.length > 0 || !hasInitialCommit) {
        if (!hasInitialCommit) {
            // Create an empty commit if the working tree is empty — the platform
            // expects every project to have at least one commit on main so the
            // post-receive deploy can find something to checkout.
            try {
                await git.commit('Initial commit', undefined, { '--allow-empty': null });
            }
            catch {
                // fall through
            }
        }
        else if (status.staged.length > 0) {
            await git.commit('Initial commit');
        }
    }
    // Ensure we're on `main`.
    try {
        await git.raw(['branch', '-M', 'main']);
    }
    catch {
        // already main; ignore
    }
    // Push, injecting the CF Access JWT via env-driven git config so the value
    // never appears on argv (no `ps` leak). See bin/src/git-auth.ts.
    await authenticatedPush({
        cwd: projectDir,
        remote: 'btrmnt',
        branch: 'main',
        token: creds.token,
    });
    const testEnv = project.environments.find((e) => e.env === 'test');
    writeStdout({
        project,
        test_url: testEnv?.url ?? null,
    });
}
export async function projectList(opts) {
    const creds = readCredentials();
    const endpoint = opts.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
    const client = new ApiClient(endpoint, creds.token);
    const projects = await client.listProjects();
    writeStdout(projects);
}
export async function projectDelete(args) {
    if (!args.yes) {
        throw new Error('refusing to delete without --yes confirmation flag');
    }
    const creds = readCredentials();
    const endpoint = args.apiEndpoint ?? creds.api_endpoint ?? resolveApiEndpoint();
    const client = new ApiClient(endpoint, creds.token);
    await client.deleteProject(args.slug);
    writeStdout({ ok: true, deleted: args.slug });
}
//# sourceMappingURL=project.js.map