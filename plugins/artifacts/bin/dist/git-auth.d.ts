export interface GitAuthEnv {
    GIT_CONFIG_COUNT: string;
    GIT_CONFIG_KEY_0: string;
    GIT_CONFIG_VALUE_0: string;
    GIT_CONFIG_KEY_1: string;
    GIT_CONFIG_VALUE_1: string;
    GIT_TERMINAL_PROMPT: string;
}
export declare function gitAuthEnv(token: string): GitAuthEnv;
export declare class GitPushError extends Error {
    readonly exitCode: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly stderr: string;
    constructor(message: string, exitCode: number | null, signal: NodeJS.Signals | null, stderr: string);
}
/**
 * Run `git push <remote> <branch>` in `cwd` with the CF Access JWT supplied
 * via env-only config so the token never appears on argv. Streams stdout +
 * stderr into in-memory buffers and resolves on success or throws
 * GitPushError on non-zero exit / signal.
 *
 * We deliberately do NOT inherit the parent's stdout/stderr; a noisy push
 * with progress meters would break the CLI's strict JSON-only output
 * contract.
 */
export declare function authenticatedPush(opts: {
    cwd: string;
    remote: string;
    branch: string;
    token: string;
}): Promise<void>;
