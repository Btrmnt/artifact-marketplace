// Output convention for the CLI.
//
//   stdout: success JSON (one trailing newline)
//   stderr: error JSON  (one trailing newline) — only on error paths
//   exit code: 0 on success, non-zero on error
//
// Both streams are ALWAYS machine-parseable JSON. Human-readable hints can be
// included as fields inside the JSON payload, never as freeform text.
export function writeStdout(value) {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}
export function writeStderrJson(value) {
    process.stderr.write(`${JSON.stringify(value)}\n`);
}
export function writeStderrRaw(line) {
    // Non-JSON stderr is reserved for one specific debug seam used by the W2d
    // test harness (AUTH_URL=<url>). Production code should not use this.
    process.stderr.write(`${line}\n`);
}
//# sourceMappingURL=output.js.map