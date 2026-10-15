import { INSIGHTS_HELP } from "./insights-help.js";

export type Subcommand = "once" | "zen-free" | "detect" | "insights" | "trend";

export const USAGE = [
  "usage: yoroi <once|zen-free|detect|insights|trend> [--pretty] [--full] [--help] [--version]",
  "",
  "examples:",
  "  yoroi once --pretty",
  "  yoroi zen-free",
  "  yoroi detect --once",
  "  yoroi insights once",
  "  yoroi insights publish --dry-run",
  "  yoroi trend --since 7d",
  "",
  "providers: defaults to all 5 (ollama-pro,opencode-go,codex,agy,claude)",
  "  select: YOROI_PROVIDERS=<comma-separated-list>",
].join("\n");

export const ONCE_HELP = [
  "usage: yoroi once [--pretty] [--full] [--refresh] [--help]",
  "",
  "collects usage snapshots once from configured providers.",
  "",
  "options:",
  "  --pretty       render visual card layout",
  "  --full         show all windows in pretty layout, including over and limit",
  "  --refresh      bypass cached usage and collect fresh snapshots",
  "  -h, --help     show help for once subcommand",
  "",
  "examples:",
  "  yoroi once",
  "  yoroi once --pretty",
  "  yoroi once --pretty --full",
].join("\n");

export const ZEN_FREE_HELP = [
  "usage: yoroi zen-free [status [--json]|report [--exceeded|--ok|--loaded]] [options]",
  "",
  "shows locally stored OpenCode Zen free usage status.",
  "No network requests are made.",
  "",
  "options:",
  "  --model <id>       model to associate with a report",
  "  --reason <text>    reason for an exceeded report",
  "  --retry-in <초>    expected retry duration in seconds",
  "  --retry-at <time>  expected retry time for an exceeded report",
  "  --loaded           record that the OpenCode plugin loaded (time only; used by the plugin)",
  "  --json             output stable status JSON (status only)",
  "  -h, --help     show help for zen-free subcommand",
].join("\n");

export const DETECT_HELP = [
  "usage: yoroi detect [--once] [--json] | yoroi detect status [--json]",
  "",
  "runs the built-in detection loop in the foreground: Zen lock events and provider usage anomalies",
  "every 600 seconds (10 minutes). Events are written to stdout one line each; diagnostics go to stderr.",
  "Keep it alive with a process supervisor; detect never daemonizes itself.",
  "",
  "options:",
  "  --once         run a single detection cycle and exit",
  "  --json         one JSON object per line (events) or one status object",
  "  status         show the last heartbeat and whether a detector is running",
  "  -h, --help     show help for detect subcommand",
].join("\n");

export const TREND_HELP = [
  "usage: yoroi trend [--provider <id>] [--window <id>] [--since 24h|7d|30d] [--pretty] [--json] [-h|--help]",
  "",
  "shows usage trends and change rates based on observation history.",
  "",
  "options:",
  "  --provider <id>     filter by provider id",
  "  --window <id>       filter by window id",
  "  --since 24h|7d|30d  time window to query (defaults to 24h and 7d)",
  "  --pretty            render table view with sparkline",
  "  --json              output JSONL format (one line per series)",
  "  -h, --help          show help for trend subcommand",
  "",
  "examples:",
  "  yoroi trend",
  "  yoroi trend --provider claude --since 7d",
  "  yoroi trend --pretty",
].join("\n");

export function getHelpText(subcommand?: Subcommand): string {
  if (subcommand === "once") return ONCE_HELP;
  if (subcommand === "zen-free") return ZEN_FREE_HELP;
  if (subcommand === "detect") return DETECT_HELP;
  if (subcommand === "insights") return INSIGHTS_HELP;
  if (subcommand === "trend") return TREND_HELP;
  return USAGE;
}
