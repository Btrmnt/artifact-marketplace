export declare const DEFAULT_API_ENDPOINT = "https://api.btrmntlab.com";
/**
 * Suffix-matched allowlist for API hosts. A bare host equal to one of these
 * is allowed; `*.<suffix>` is allowed too. Anything else requires the
 * `--allow-unknown-host` flag / `BTRMNT_ALLOW_UNKNOWN_HOST=1` opt-in.
 */
export declare const ALLOWED_HOST_SUFFIXES: string[];
export declare class ConfigError extends Error {
    constructor(message: string);
}
export interface ValidateOptions {
    /** Allow plain `http://` for hosts that aren't loopback. Off by default. */
    allowInsecure?: boolean;
    /** Allow hosts outside ALLOWED_HOST_SUFFIXES. Off by default. */
    allowUnknownHost?: boolean;
}
/**
 * Parse + validate an API endpoint string. Returns the trimmed value on
 * success; throws ConfigError otherwise. Loopback hosts skip both the
 * https and allowlist checks (those are for tests and self-hosted dev).
 *
 * The two opt-in flags (`allowInsecure`, `allowUnknownHost`) are also
 * honoured from env (`BTRMNT_ALLOW_INSECURE=1`, `BTRMNT_ALLOW_UNKNOWN_HOST=1`)
 * so users with self-hosted deployments can set them once in their shell
 * rather than thread them through every CLI invocation.
 */
export declare function validateApiEndpoint(candidate: string, opts?: ValidateOptions): string;
export declare function resolveApiEndpoint(flag?: string): string;
export declare function resolveCredentialsPath(): string;
/**
 * Returns the dir under which the credentials file should live. Useful for
 * mkdirSync recursive before writing.
 */
export declare function credentialsDir(path: string): string;
/**
 * Working directory the CLI should treat as "the project". Tests can override
 * via BTRMNT_TEST_CWD so we don't have to chdir() the test runner.
 */
export declare function resolveCwd(): string;
