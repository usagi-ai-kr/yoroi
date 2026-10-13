export type InsightsParsedArgs =
  | { readonly kind: "help"; readonly subcommand: "insights" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "insights"; readonly operation: "once"; readonly pretty?: boolean; readonly refresh?: boolean;
      readonly full?: boolean; readonly markdown?: boolean }
  | { readonly kind: "insights"; readonly operation: "publish"; readonly dryRun?: boolean; readonly notBefore?: string };

/** `yoroi insights once [--pretty] [--refresh] [--full] [--markdown]` (contract 1-A). No other operations or flags. */
export function parseInsights(argv: readonly string[]): InsightsParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help", subcommand: "insights" };
  const [operation, ...rest] = argv;
  if (operation === undefined) return { kind: "error", message: "missing insights operation" };
  if (operation === "publish") return parsePublish(rest);
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

function parsePublish(args: readonly string[]): InsightsParsedArgs {
  let dryRun = false, notBefore: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--dry-run" && !dryRun) { dryRun = true; continue; }
    if (arg === "--not-before" && notBefore === undefined) {
      const value = args[++i];
      if (!value || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return { kind: "error", message: "invalid --not-before; expected HH:MM" };
      notBefore = value; continue;
    }
    return { kind: "error", message: `unexpected argument: ${arg}` };
  }
  return { kind: "insights", operation: "publish", ...(dryRun && { dryRun: true }), ...(notBefore && { notBefore }) };
}
