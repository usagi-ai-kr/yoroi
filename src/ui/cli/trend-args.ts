import type { ProviderId } from "../../domain/usage.js";
import { isProviderId } from "../../domain/types.js";

export interface TrendParsedArgs {
  readonly kind: "trend";
  readonly provider?: ProviderId;
  readonly windowId?: string;
  readonly since?: "24h" | "7d" | "30d";
  readonly pretty?: boolean;
  readonly json?: boolean;
}

export type TrendResult =
  | TrendParsedArgs
  | { readonly kind: "help"; readonly subcommand: "trend" }
  | { readonly kind: "error"; readonly message: string };

const VALID_SINCE = new Set(["24h", "7d", "30d"]);

export function parseTrend(argv: readonly string[]): TrendResult {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help", subcommand: "trend" };

  let provider: ProviderId | undefined;
  let windowId: string | undefined;
  let since: "24h" | "7d" | "30d" | undefined;
  let pretty = false;
  let json = false;
  const seen = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--pretty" || arg === "--json") {
      if (seen.has(arg)) return { kind: "error", message: `duplicate flag: ${arg}` };
      seen.add(arg);
      if (arg === "--pretty") pretty = true;
      if (arg === "--json") json = true;
      continue;
    }

    if (arg === "--provider" || arg === "--window" || arg === "--since") {
      if (seen.has(arg)) return { kind: "error", message: `duplicate flag: ${arg}` };
      seen.add(arg);
      const val = argv[++i];
      if (val === undefined || val.startsWith("-")) {
        return { kind: "error", message: `missing value for ${arg}` };
      }
      if (arg === "--provider") {
        if (!isProviderId(val)) return { kind: "error", message: `invalid provider: ${val}` };
        provider = val;
      } else if (arg === "--window") {
        windowId = val;
      } else if (arg === "--since") {
        if (!VALID_SINCE.has(val)) return { kind: "error", message: `invalid since: ${val}` };
        since = val as "24h" | "7d" | "30d";
      }
      continue;
    }

    return { kind: "error", message: `unexpected argument: ${arg}` };
  }

  if (pretty && json) {
    return { kind: "error", message: "cannot specify both --pretty and --json" };
  }

  return {
    kind: "trend",
    ...(provider !== undefined && { provider }),
    ...(windowId !== undefined && { windowId }),
    ...(since !== undefined && { since }),
    ...(pretty && { pretty: true }),
    ...(json && { json: true }),
  };
}
