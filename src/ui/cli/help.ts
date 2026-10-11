export type Subcommand = "once" | "zen-free";

export const USAGE = [
  "usage: yoroi <once|zen-free> [--pretty] [--help] [--version]",
  "",
  "examples:",
  "  yoroi once --pretty",
  "  yoroi zen-free",
  "",
  "providers: defaults to all 5 (ollama-pro,opencode-go,codex,agy,claude)",
  "  select: YOROI_PROVIDERS=<comma-separated-list>",
].join("\n");

export const ONCE_HELP = [
  "usage: yoroi once [--pretty] [--refresh] [--help]",
  "",
  "collects usage snapshots once from configured providers.",
  "",
  "options:",
  "  --pretty       render visual card layout",
  "  --refresh      bypass cached usage and collect fresh snapshots",
  "  -h, --help     show help for once subcommand",
  "",
  "examples:",
  "  yoroi once",
  "  yoroi once --pretty",
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

export function getHelpText(subcommand?: Subcommand): string {
  if (subcommand === "once") return ONCE_HELP;
  if (subcommand === "zen-free") return ZEN_FREE_HELP;
  return USAGE;
}
