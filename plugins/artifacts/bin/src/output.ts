// Output convention for the CLI.
//
//   stdout: success JSON (one trailing newline)
//   stderr: progress / error JSON (one trailing newline) — both kinds of
//           non-success output use the same JSON-only channel; success is
//           signalled by exit code 0 + a stdout JSON line.
//
// Both streams are ALWAYS machine-parseable JSON. Human-readable hints
// (e.g. the device-flow `hint` field) live as fields inside the JSON
// payload, never as freeform text.

export function writeStdout(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

export function writeStderrJson(value: unknown): void {
  process.stderr.write(`${JSON.stringify(value)}\n`)
}
