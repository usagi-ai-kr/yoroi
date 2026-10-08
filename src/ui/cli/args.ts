import type { Subcommand } from "./help.js";

export type ParsedArgs =
  | { readonly kind: "help"; readonly subcommand?: Subcommand }
  | { readonly kind: "version" }
  | { readonly kind: "once"; readonly pretty?: boolean }
  | { readonly kind: "watch"; readonly intervalMs?: number; readonly pretty?: boolean }
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

function parseOnce(args: readonly string[]): ParsedArgs {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help", subcommand: "once" };
  }
  if (args.length === 0) return { kind: "once" };
  if (args.length === 1 && args[0] === "--pretty") return { kind: "once", pretty: true };
  if (args[0] === "--pretty") return { kind: "error", message: `unexpected argument: ${args[1]}` };
  return { kind: "error", message: `unexpected argument: ${args[0]}` };
}

function parseWatch(args: readonly string[]): ParsedArgs {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help", subcommand: "watch" };
  }
  let intervalMs: number | undefined;
  let pretty: boolean | undefined;
  let idx = 0;
  while (idx < args.length) {
    const flag = args[idx];
    if (flag === "--pretty") {
      if (pretty !== undefined) return { kind: "error", message: "duplicate --pretty" };
      pretty = true;
      idx += 1;
    } else if (flag === "--interval") {
      if (intervalMs !== undefined) return { kind: "error", message: "duplicate --interval" };
      const val = args[idx + 1];
      if (val === undefined) return { kind: "error", message: "invalid --interval: (missing)" };
      const parsed = parseInterval(val);
      if (parsed === null) return { kind: "error", message: `invalid --interval: ${val}` };
      intervalMs = parsed;
      idx += 2;
    } else {
      return { kind: "error", message: `unexpected argument: ${flag}` };
    }
  }
  return {
    kind: "watch",
    ...(intervalMs !== undefined ? { intervalMs } : {}),
    ...(pretty !== undefined ? { pretty } : {}),
  };
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const command = argv[0];
  if (command === undefined) return { kind: "error", message: "missing command" };
  if (command === "--help" || command === "-h") return { kind: "help" };
  if (command === "--version" || command === "-v") {
    return argv.length === 1 ? { kind: "version" } : { kind: "error", message: "unexpected version argument" };
  }
  if (command === "once") return parseOnce(argv.slice(1));
  if (command === "watch") return parseWatch(argv.slice(1));
  return { kind: "error", message: `unknown command: ${command}` };
}
