import type { EnvScope, Role } from '@btrmnt/artifact-types';
export declare function grant(args: {
    email: string;
    slug?: string;
    env: EnvScope;
    apiEndpoint?: string;
}): Promise<void>;
export declare function revoke(args: {
    email: string;
    slug?: string;
    env: EnvScope;
    apiEndpoint?: string;
}): Promise<void>;
export declare function invite(args: {
    email: string;
    role: Role;
    apiEndpoint?: string;
}): Promise<void>;
