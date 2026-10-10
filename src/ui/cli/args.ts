import type { Subcommand } from "./help.js";
import { parseZenFree, type ZenFreeParsedArgs } from "./zen-free-args.js";
export type ParsedArgs =
  | { readonly kind: "help"; readonly subcommand?: Subcommand }
  | { readonly kind: "version" }
  | { readonly kind: "once"; readonly pretty?: boolean; readonly refresh?: boolean }
  | ZenFreeParsedArgs
  | { readonly kind: "error"; readonly message: string };
function parseOnce(args: readonly string[]): ParsedArgs {
  if (args.includes("--help") || args.includes("-h")) return { kind: "help", subcommand: "once" };
  const seen = new Set<string>();
  for (const arg of args) {
    if (!["--pretty", "--refresh"].includes(arg) || seen.has(arg)) {
      return { kind: "error", message: `unexpected argument: ${arg}` };
    }
    seen.add(arg);
  }
  return { kind: "once", ...(seen.has("--pretty") && { pretty: true }),
    ...(seen.has("--refresh") && { refresh: true }) };
}
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const command = argv[0];
  if (!command) return { kind: "error", message: "missing command" };
  if (command === "--help" || command === "-h") return { kind: "help" };
  if (command === "--version" || command === "-v") return argv.length === 1 ? { kind: "version" } :
    { kind: "error", message: "unexpected version argument" };
  if (command === "once") return parseOnce(argv.slice(1));
  if (command === "zen-free") return parseZenFree(argv.slice(1));
  if (command === "watch") return { kind: "error", message: "watch command removed; use yoroi once" };
  return { kind: "error", message: `unknown command: ${command}` };
}
