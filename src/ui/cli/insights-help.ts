export const INSIGHTS_HELP = [
  "usage: yoroi insights once [--pretty] [--refresh] [--full] [--markdown] [--help]",
  "",
  "collects the AI data-source insights letter once and writes it to stdout.",
  "Internal use only: no external delivery, scheduling or LLM calls.",
  "",
  "options:",
  "  --pretty       render the Korean letter layout",
  "  --refresh      replace today's stored success and collect fresh data",
  "  --full         render full detailed letter with all evidence rows",
  "  --markdown     render GitHub issue markdown layout",
  "  -h, --help     show help for insights subcommand",
].join("\n");
