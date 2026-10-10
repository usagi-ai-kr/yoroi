#!/bin/bash
# Reusable worker watch: exit when reports appear, a pane blocks, or a quota message shows.
# Repo-specific values (pane ids, report paths) belong in the caller's arguments.
# Exit codes: 0 = detected (BLOCKED/NEW/LIMIT), 2 = usage error, 3 = polled to the end (no change).
# Usage:
#   watch_workers.sh --reports <file> [<file>...] --panes <pane> [<pane>...]
#                    [--interval 20] [--max-polls 120] [--tail 15] [--herdr <cmd>]
#                    [--limit-pattern <ERE>]
set -uo pipefail

usage() {
  echo "usage: watch_workers.sh --reports <file>... --panes <pane>..." \
    "[--interval n] [--max-polls n] [--tail n] [--herdr cmd] [--limit-pattern ERE]" >&2
}
reports=(); panes=(); interval=20; max_polls=120; tail_lines=15; herdr_cmd=herdr
# Concrete quota wording only; broad phrases like "usage limit" also match worker prose.
limit_pattern='Free usage exceeded|usage limit reached|quota (exceeded|exhausted)|retrying in [0-9]'
# Bash splits pane ids on whitespace itself; do not quote-expand untrusted lists.
need_value() { [[ $# -ge 2 && "$2" != --* ]] || { echo "missing value for $1" >&2; usage; exit 2; }; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reports|--panes)
      flag="$1"; shift; list=()
      while [[ $# -gt 0 && "$1" != --* ]]; do list+=("$1"); shift; done
      [[ ${#list[@]} -gt 0 ]] || { echo "empty list for $flag" >&2; usage; exit 2; }
      if [[ "$flag" == --reports ]]; then reports+=("${list[@]}"); else panes+=("${list[@]}"); fi ;;
    --interval) need_value "$@"; interval="$2"; shift 2 ;;
    --max-polls) need_value "$@"; max_polls="$2"; shift 2 ;;
    --tail) need_value "$@"; tail_lines="$2"; shift 2 ;;
    --herdr) need_value "$@"; herdr_cmd="$2"; shift 2 ;;
    --limit-pattern) need_value "$@"; limit_pattern="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; usage; exit 2 ;;
  esac
done
[[ ${#reports[@]} -gt 0 && ${#panes[@]} -gt 0 ]] || { usage; exit 2; }

# Snapshot full paths so same-named files in different directories stay distinguishable.
snapshot() { local out=(); for f in "${reports[@]}"; do [[ -f "$f" ]] && out+=("$f"); done
  printf '%s\n' "${out[@]-}"; }
blocked_panes() {
  "$herdr_cmd" agent list 2>/dev/null | python3 -c '
import json, sys
try:
    agents = json.load(sys.stdin)["result"]["agents"]
except Exception:
    sys.exit(0)
watched = set(sys.argv[1:])
print("\n".join(a["pane_id"] for a in agents
      if a.get("pane_id") in watched and a.get("agent_status") == "blocked"))' "${panes[@]}"
}
limit_hit() {
  local p
  for p in "${panes[@]}"; do
    "$herdr_cmd" agent read "$p" --source visible 2>/dev/null \
      | grep -qiE "$limit_pattern" && { echo "$p"; return 0; }
  done
  return 1
}
seen="$(snapshot)"
for ((i = 0; i < max_polls; i++)); do
  blocked="$(blocked_panes)"
  if [[ -n "$blocked" ]]; then
    echo "BLOCKED $(date +%T)"; while IFS= read -r p; do
      [[ -n "$p" ]] || continue
      echo "--- $p"
      "$herdr_cmd" agent read "$p" --source visible 2>/dev/null | grep -v '^[[:space:]]*$' | tail -n "$tail_lines"
    done <<< "$blocked"
    exit 0
  fi
  pane="$(limit_hit || true)"
  [[ -n "$pane" ]] && { echo "LIMIT $pane $(date +%T)"; exit 0; }
  now="$(snapshot)"
  if [[ "$now" != "$seen" ]]; then echo "NEW $(date +%T)"; printf '%s\n' "$now"; exit 0; fi
  sleep "$interval"
done
echo "timeout: no change after $max_polls polls" >&2
exit 3