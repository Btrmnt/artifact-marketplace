export interface LoginOptions {
    apiEndpoint?: string;
    timeoutMs?: number;
}
/**
 * Best-effort decode of a JWT's `exp` claim into an ISO timestamp. Returns
 * `null` if the token isn't a parseable JWT or has no numeric `exp`. We
 * never throw — login should succeed even if the JWT shape is unexpected.
 */
export declare function expiresAtFromJwt(token: string): string | null;
export declare function login(opts: LoginOptions): Promise<void>;
