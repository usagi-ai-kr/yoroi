export type Subcommand = "once" | "watch";

export const USAGE = [
  "usage: yoroi <once|watch> [--interval <seconds>] [--pretty] [--help] [--version]",
  "",
  "examples:",
  "  yoroi once --pretty",
  "  yoroi watch --pretty",
  "  yoroi watch --interval 30 --pretty",
  "",
  "providers: defaults to all 5 (ollama-pro,opencode-go,codex,agy,claude)",
  "  select: YOROI_PROVIDERS=<comma-separated-list>",
  "",
  "watch: waits for interval after collection completes (non-overlapping)",
].join("\n");

export const ONCE_HELP = [
  "usage: yoroi once [--pretty] [--help]",
  "",
  "collects usage snapshots once from configured providers.",
  "",
  "options:",
  "  --pretty       render visual card layout",
  "  -h, --help     show help for once subcommand",
  "",
  "examples:",
  "  yoroi once",
  "  yoroi once --pretty",
].join("\n");

export const WATCH_HELP = [
  "usage: yoroi watch [--interval <seconds>] [--pretty] [--help]",
  "",
  "monitors provider usage at regular intervals.",
  "",
  "options:",
  "  --interval <seconds>  seconds between collections (default: 60)",
  "  --pretty              render visual card layout",
  "  -h, --help            show help for watch subcommand",
  "",
  "examples:",
  "  yoroi watch",
  "  yoroi watch --pretty",
  "  yoroi watch --interval 30 --pretty",
].join("\n");

export function getHelpText(subcommand?: Subcommand): string {
  if (subcommand === "once") return ONCE_HELP;
  if (subcommand === "watch") return WATCH_HELP;
  return USAGE;
}
