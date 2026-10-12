export type InsightsParsedArgs =
  | { readonly kind: "help"; readonly subcommand: "insights" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "insights"; readonly operation: "once"; readonly pretty?: boolean; readonly refresh?: boolean;
      readonly full?: boolean; readonly markdown?: boolean };

/** `yoroi insights once [--pretty] [--refresh] [--full] [--markdown]` (contract 1-A). No other operations or flags. */
export function parseInsights(argv: readonly string[]): InsightsParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help", subcommand: "insights" };
  const [operation, ...rest] = argv;
  if (operation === undefined) return { kind: "error", message: "missing insights operation" };
  if (operation !== "once") return { kind: "error", message: `unexpected argument: ${operation}` };
  const seen = new Set<string>();
  for (const arg of rest) {
    if (!["--pretty", "--refresh", "--full", "--markdown"].includes(arg) || seen.has(arg)) {
      return { kind: "error", message: `unexpected argument: ${arg}` };
    }
    seen.add(arg);
  }
  if (seen.has("--markdown") && seen.has("--full")) {
    return { kind: "error", message: "cannot combine --markdown with --full" };
  }
  return { kind: "insights", operation: "once", ...(seen.has("--pretty") && { pretty: true }),
    ...(seen.has("--refresh") && { refresh: true }), ...(seen.has("--full") && { full: true }),
    ...(seen.has("--markdown") && { markdown: true }) };
}
