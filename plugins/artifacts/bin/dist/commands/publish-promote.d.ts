export declare function publish(args: {
    message?: string;
    apiEndpoint?: string;
    allowSecrets?: boolean;
}): Promise<void>;
export declare function promote(args: {
    project?: string;
    apiEndpoint?: string;
}): Promise<void>;
export declare function rollback(args: {
    project?: string;
    to: string;
    apiEndpoint?: string;
}): Promise<void>;
/**
 * Pull a slug out of a remote URL like:
 *   https://api.btrmntlab.com/git/<tenant>/<slug>.git
 *   file:///tmp/.../<slug>.git
 *   git@host:tenant/slug.git
 */
export declare function slugFromRemote(url: string): string | null;
