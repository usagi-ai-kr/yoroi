import type { Subcommand } from "./help.js";
import { parseZenFree, type ZenFreeParsedArgs } from "./zen-free-args.js";
export type ParsedArgs =
  | { readonly kind: "help"; readonly subcommand?: Subcommand }
  | { readonly kind: "version" }
  | { readonly kind: "once"; readonly pretty?: boolean }
  | ZenFreeParsedArgs
  | { readonly kind: "error"; readonly message: string };
function parseOnce(args: readonly string[]): ParsedArgs {
  if (args.includes("--help") || args.includes("-h")) return { kind: "help", subcommand: "once" };
  if (!args.length) return { kind: "once" };
  if (args.length === 1 && args[0] === "--pretty") return { kind: "once", pretty: true };
  return { kind: "error", message: `unexpected argument: ${args[0] === "--pretty" ? args[1] : args[0]}` };
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
