export declare function projectNew(args: {
    slug: string;
    path?: string;
    apiEndpoint?: string;
    allowSecrets?: boolean;
}): Promise<void>;
export declare function projectList(opts: {
    apiEndpoint?: string;
}): Promise<void>;
export declare function projectDelete(args: {
    slug: string;
    yes: boolean;
    apiEndpoint?: string;
}): Promise<void>;
