import type { Subcommand } from "./help.js";
export type ParsedArgs =
  | { readonly kind: "help"; readonly subcommand?: Subcommand }
  | { readonly kind: "version" }
  | { readonly kind: "once"; readonly pretty?: boolean }
  | { readonly kind: "zen-free"; readonly operation: "status" | "exceeded" | "ok";
      readonly model?: string; readonly reason?: string; readonly retryAt?: string; readonly retryInSeconds?: number }
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
function parseZenFree(argv: readonly string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help", subcommand: "zen-free" };
  const args = argv[0] === "report" ? argv.slice(1) : argv;
  let operation: "status" | "exceeded" | "ok" = "status", explicitStatus = false;
  let model: string | undefined, reason: string | undefined, retryAt: string | undefined;
  let retryInSeconds: number | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === "status") {
      if (explicitStatus || operation !== "status") return { kind: "error", message: "duplicate status" };
      explicitStatus = true; continue;
    }
    if (flag === "--exceeded" || flag === "--ok") {
      if (operation !== "status" || explicitStatus) return { kind: "error", message: "status does not accept write flags" };
      operation = flag === "--exceeded" ? "exceeded" : "ok"; continue;
    }
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
  return { kind: "zen-free", operation, ...(model && { model }), ...(reason && { reason }),
    ...(retryAt && { retryAt }), ...(retryInSeconds !== undefined && { retryInSeconds }) };
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
