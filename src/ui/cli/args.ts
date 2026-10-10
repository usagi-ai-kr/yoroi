import type { Subcommand } from "./help.js";
import { parseZenFree, type ZenFreeParsedArgs } from "./zen-free-args.js";
export type ParsedArgs =
  | { readonly kind: "help"; readonly subcommand?: Subcommand }
  | { readonly kind: "version" }
  | { readonly kind: "once"; readonly pretty?: boolean }
  | ZenFreeParsedArgs
  | { readonly kind: "watch"; readonly intervalMs?: number; readonly pretty?: boolean }
  | { readonly kind: "error"; readonly message: string };
export const MAX_INTERVAL_SECONDS = 86_400;
function parseInterval(value: string | undefined): number | null {
  const seconds = Number(value), milliseconds = seconds * 1000;
  return value !== undefined && Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_INTERVAL_SECONDS &&
    Number.isSafeInteger(milliseconds) && milliseconds > 0 ? milliseconds : null;
}
function parseOnce(args: readonly string[]): ParsedArgs {
  if (args.includes("--help") || args.includes("-h")) return { kind: "help", subcommand: "once" };
  if (!args.length) return { kind: "once" };
  if (args.length === 1 && args[0] === "--pretty") return { kind: "once", pretty: true };
  return { kind: "error", message: `unexpected argument: ${args[0] === "--pretty" ? args[1] : args[0]}` };
}
function parseWatch(args: readonly string[]): ParsedArgs {
  if (args.includes("--help") || args.includes("-h")) return { kind: "help", subcommand: "watch" };
  let intervalMs: number | undefined, pretty: boolean | undefined;
  for (let i = 0; i < args.length;) {
    const flag = args[i];
    if (flag === "--pretty") {
      if (pretty !== undefined) return { kind: "error", message: "duplicate --pretty" };
      pretty = true; i += 1;
    } else if (flag === "--interval") {
      if (intervalMs !== undefined) return { kind: "error", message: "duplicate --interval" };
      const value = args[i + 1], parsed = parseInterval(value);
      if (parsed === null) return { kind: "error", message: `invalid --interval: ${value ?? "(missing)"}` };
      intervalMs = parsed; i += 2;
    } else return { kind: "error", message: `unexpected argument: ${flag}` };
  }
  return { kind: "watch", ...(intervalMs !== undefined && { intervalMs }), ...(pretty && { pretty }) };
}
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const command = argv[0];
  if (!command) return { kind: "error", message: "missing command" };
  if (command === "--help" || command === "-h") return { kind: "help" };
  if (command === "--version" || command === "-v") return argv.length === 1 ? { kind: "version" } :
    { kind: "error", message: "unexpected version argument" };
  if (command === "once") return parseOnce(argv.slice(1));
  if (command === "zen-free") return parseZenFree(argv.slice(1));
  if (command === "watch") return parseWatch(argv.slice(1));
  return { kind: "error", message: `unknown command: ${command}` };
}
