export interface Credentials {
    api_endpoint: string;
    token: string;
    expires_at: string | null;
}
export declare class CredentialsError extends Error {
    constructor(message: string);
}
export declare function writeCredentials(creds: Credentials): string;
export declare function readCredentials(): Credentials;
