import type { CreateGrantRequest, CreateInviteRequest, CreateInviteResponse, CreateProjectRequest, EnvScope, Grant, Membership, Project, ProjectEnvironment, User } from '@btrmnt/artifact-types';
export declare const USER_AGENT = "btrmnt-plugin/0.1.0-security";
export declare class ApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown);
}
export declare class ApiClient {
    private readonly token;
    private readonly endpoint;
    constructor(endpoint: string, token: string);
    private request;
    whoami(): Promise<{
        user: User;
        memberships: Membership[];
    }>;
    listProjects(): Promise<Project[]>;
    createProject(req: CreateProjectRequest): Promise<Project>;
    deleteProject(slug: string): Promise<void>;
    promote(slug: string): Promise<ProjectEnvironment>;
    rollback(slug: string, sha: string): Promise<ProjectEnvironment>;
    grant(slug: string, req: CreateGrantRequest): Promise<Grant[]>;
    revoke(slug: string, email: string, env: EnvScope): Promise<void>;
    invite(req: CreateInviteRequest): Promise<CreateInviteResponse>;
}
