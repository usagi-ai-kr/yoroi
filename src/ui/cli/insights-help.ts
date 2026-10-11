export const INSIGHTS_HELP = [
  "usage: yoroi insights once [--pretty] [--refresh] [--help]",
  "",
  "collects the AI data-source insights letter once and writes it to stdout.",
  "Internal use only: no external delivery, scheduling or LLM calls.",
  "",
  "options:",
  "  --pretty       render the Korean letter layout",
  "  --refresh      replace today's stored success and collect fresh data",
  "  -h, --help     show help for insights subcommand",
].join("\n");
