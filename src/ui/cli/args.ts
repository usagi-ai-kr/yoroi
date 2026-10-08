export type ParsedArgs =
  | { readonly kind: "help" }
  | { readonly kind: "version" }
  | { readonly kind: "once" }
  | { readonly kind: "watch"; readonly intervalMs: number | undefined }
  | { readonly kind: "error"; readonly message: string };

export const MAX_INTERVAL_SECONDS = 86_400;

function parseInterval(value: string | undefined): number | null {
  if (value === undefined) return null;
  const seconds = Number(value);
  const milliseconds = seconds * 1000;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_INTERVAL_SECONDS ||
    !Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    return null;
  }
  return milliseconds;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const command = argv[0];
  if (command === undefined) return { kind: "error", message: "missing command" };
  if (command === "--help" || command === "-h") return { kind: "help" };
  if (command === "--version" || command === "-v") {
    return argv.length === 1 ? { kind: "version" } : { kind: "error", message: "unexpected version argument" };
  }
  if (command === "once") {
    if (argv.length > 1) return { kind: "error", message: `unexpected argument: ${argv[1]}` };
    return { kind: "once" };
  }
  if (command === "watch") {
    const [flag, value, ...rest] = argv.slice(1);
    if (flag === undefined) return { kind: "watch", intervalMs: undefined };
    if (flag !== "--interval") return { kind: "error", message: `unexpected argument: ${flag}` };
    if (rest.length > 0) return { kind: "error", message: `unexpected argument: ${rest[0]}` };
    const intervalMs = parseInterval(value);
    if (intervalMs === null) {
      return { kind: "error", message: `invalid --interval: ${value ?? "(missing)"}` };
    }
    return { kind: "watch", intervalMs };
  }
  return { kind: "error", message: `unknown command: ${command}` };
}
