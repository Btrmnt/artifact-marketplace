export interface SecretMatch {
    file: string;
    rule: string;
}
export declare class SecretFoundError extends Error {
    readonly matches: SecretMatch[];
    constructor(matches: SecretMatch[]);
}
/**
 * Scan a set of repo-relative file paths. Throws SecretFoundError if any
 * file trips a rule. The caller is responsible for producing the list
 * (typically via `git ls-files --others --exclude-standard --cached` so
 * gitignored files are skipped).
 */
/**
 * Ask git for the list of paths that a `git add .` would stage — i.e.
 * tracked files plus untracked files that are NOT gitignored. Returns
 * POSIX-separator paths relative to `root`.
 *
 * Takes a thin `SimpleGitLike` interface so callers can pass either a
 * real simple-git instance or a test fake without dragging the simple-git
 * type surface across modules.
 */
export interface SimpleGitLike {
    raw(args: string[]): Promise<string>;
}
export declare function candidatePathsFromGit(git: SimpleGitLike): Promise<string[]>;
export declare function assertNoSecrets(root: string, relPaths: Iterable<string>): void;
/** Default .gitignore scaffolded into a new project on `btrmnt project new`. */
export declare const DEFAULT_GITIGNORE = "# Created by btrmnt project new.\n# These patterns keep secrets and build artefacts from being pushed to the\n# hosted git remote on `btrmnt publish`. Tighten or remove anything you\n# don't need \u2014 but keep the secret-bearing entries.\nnode_modules/\ndist/\nbuild/\n.next/\n.cache/\n.env\n.env.*\n!.env.example\n!.env.sample\n!.env.template\n*.pem\n*.p12\n*.pfx\nid_rsa\nid_rsa.*\nid_ed25519\nid_ed25519.*\n.aws/\n.gcloud/\n.kube/config\nserviceAccountKey*.json\n.DS_Store\n*.log\n";
