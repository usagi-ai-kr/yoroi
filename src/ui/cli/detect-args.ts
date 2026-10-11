export type DetectParsedArgs =
  | { readonly kind: "help"; readonly subcommand: "detect" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "detect"; readonly operation: "run" | "once" | "status"; readonly json?: boolean };

/** `yoroi detect [--once] [--json]` (foreground loop) and `yoroi detect status [--json]`. No other options. */
export function parseDetect(argv: readonly string[]): DetectParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help", subcommand: "detect" };
  let status = false, once = false, json = false;
  for (const arg of argv) {
    if (arg === "status" && !status) status = true;
    else if (arg === "--once" && !once) once = true;
    else if (arg === "--json" && !json) json = true;
    else return { kind: "error", message: `unexpected argument: ${arg}` };
  }
  if (status && once) return { kind: "error", message: "status does not accept --once" };
  return { kind: "detect", operation: status ? "status" : once ? "once" : "run", ...(json && { json }) };
}
