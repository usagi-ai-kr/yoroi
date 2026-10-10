export type ZenFreeParsedArgs =
  | { readonly kind: "help"; readonly subcommand: "zen-free" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "zen-free"; readonly operation: "status" | "exceeded" | "ok";
      readonly model?: string; readonly reason?: string; readonly retryAt?: string;
      readonly retryInSeconds?: number; readonly json?: boolean };

function validRetryAt(value: string): boolean {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(Z|([+-])(\d\d):(\d\d))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day!);
  const zoneValid = match[7] === 'Z' || (Number(match[9]) < 24 && Number(match[10]) < 60);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day &&
    hour! < 24 && minute! < 60 && second! < 60 && zoneValid;
}

export function parseZenFree(argv: readonly string[]): ZenFreeParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help", subcommand: "zen-free" };
  const args = argv[0] === "report" ? argv.slice(1) : argv;
  let operation: "status" | "exceeded" | "ok" = "status", explicitStatus = false;
  let model: string | undefined, reason: string | undefined, retryAt: string | undefined, json = false;
  let retryInSeconds: number | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === "status") { if (explicitStatus || operation !== "status") return { kind: "error", message: "duplicate status" };
      explicitStatus = true; continue; }
    if (flag === "--exceeded" || flag === "--ok") {
      if (operation !== "status" || explicitStatus) return { kind: "error", message: "status does not accept write flags" };
      operation = flag === "--exceeded" ? "exceeded" : "ok"; continue; }
    if (flag === "--json") { if (json) return { kind: "error", message: "duplicate --json" }; json = true; continue; }
    if (!["--model", "--reason", "--retry-in", "--retry-at"].includes(flag ?? "")) {
      return { kind: "error", message: `unexpected argument: ${flag}` };
    }
    const value = args[++i];
    if (!value || value.startsWith("--")) return { kind: "error", message: `missing value for ${flag}` };
    if (flag === "--model") model = value;
    if (flag === "--reason") reason = value;
    if (flag === "--retry-in") {
      const seconds = Number(value);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(seconds) || seconds < 1 || seconds > 31_536_000)
        return { kind: "error", message: `invalid --retry-in: ${value}` };
      retryInSeconds = seconds;
    }
    if (flag === "--retry-at") { if (!validRetryAt(value)) return { kind: "error", message: `invalid --retry-at: ${value}` }; retryAt = value; }
  }
  if (retryAt && retryInSeconds !== undefined) return { kind: "error", message: "choose only one retry option" };
  if ((explicitStatus || operation === "status") && (model || reason || retryAt || retryInSeconds !== undefined)) {
    return { kind: "error", message: "status does not accept report options" };
  }
  if (operation === "ok" && (reason || retryAt || retryInSeconds !== undefined)) {
    return { kind: "error", message: "retry options require --exceeded" };
  }
  if (json && operation !== "status") return { kind: "error", message: "--json is only available for status" };
  return { kind: "zen-free", operation, ...(model && { model }), ...(reason && { reason }),
    ...(retryAt && { retryAt }), ...(retryInSeconds !== undefined && { retryInSeconds }), ...(json && { json }) };
}
