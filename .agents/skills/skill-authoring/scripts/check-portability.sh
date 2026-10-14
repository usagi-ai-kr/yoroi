#!/usr/bin/env bash
# 스킬·룰의 프로젝트 결합(탈맥락 위반)을 찾는다.
# 스킬 본문에 레포 고유 값(절대 경로·프로젝트명·pane id·모델/요금제 이름·사람 이름)이
# 박혀 있으면 다른 레포에서 재사용할 수 없다. 이 검사가 그 위반을 줄 번호와 함께 보고한다.
#
# 사용: check-portability.sh [스킬 루트] [--strict]
#   기본 루트는 .agents/skills. --strict 이면 예외 목록(allow)도 함께 위반으로 본다.
# exit 0 = 위반 없음 / 1 = 위반 있음 / 2 = 사용 오류
#
# 예외: 같은 줄 끝에 `portability-ok` 주석이 있으면 그 줄은 건너뛴다.
#       스킬 폴더의 `portability-allow.txt`에 정규식을 한 줄씩 적어도 건너뛴다.
set -uo pipefail

ROOT=".agents/skills"; STRICT=0
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) ROOT="$arg" ;;
  esac
done
[ -d "$ROOT" ] || { echo "스킬 루트 없음: $ROOT" >&2; exit 2; }

# 프로젝트 고유 값 패턴(ERE). 환경변수 PORTABILITY_EXTRA 로 추가할 수 있다.
PATTERNS='/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+|/tmp/[a-z0-9]+-[A-Za-z0-9._-]+'
PATTERNS="$PATTERNS|yoroi|plantaro|qketing|gabriel|코테츠|가브리엘|애식이"
PATTERNS="$PATTERNS|\\bw[0-9]+:(p|t)[A-Za-z0-9]+"
PATTERNS="$PATTERNS|ChatGPT Plus|Claude Pro|Google AI Pro|Ollama Cloud|OpenCode Go Plus|Antigravity|Cursor Pro"
PATTERNS="$PATTERNS|gpt-[0-9]|claude-(opus|sonnet|haiku)|gemini-[0-9]|deepseek-v|glm-[0-9]|kimi-k|grok-[0-9]|mimo-v|nemotron-|minimax-m"
PATTERNS="$PATTERNS|insights publish|insights once|zen-free|letter-top10"
[ -n "${PORTABILITY_EXTRA:-}" ] && PATTERNS="$PATTERNS|$PORTABILITY_EXTRA"

ALLOW_RE=""
add_allow() { [ -n "$1" ] && ALLOW_RE="${ALLOW_RE:+$ALLOW_RE|}$1"; }
while IFS= read -r pat; do add_allow "$pat"; done < <(find "$ROOT" -name portability-allow.txt -type f -exec cat {} + 2>/dev/null | sed '/^\s*$/d;/^\s*#/d')

viol=0; allow_hits=0
while IFS= read -r file; do
  rel="${file#"$ROOT"/}"
  while IFS= read -r hit; do
    line="${hit%%:*}"; text="${hit#*:}"
    case "$text" in *portability-ok*) allow_hits=$((allow_hits+1)); continue;; esac
    if [ -n "$ALLOW_RE" ] && printf '%s' "$text" | grep -qE "$ALLOW_RE"; then
      allow_hits=$((allow_hits+1)); [ "$STRICT" = 1 ] && { echo "ALLOW $rel:$line:$text"; viol=$((viol+1)); }
      continue
    fi
    echo "VIOL $rel:$line:$text"
    viol=$((viol+1))
  done < <(grep -nE "$PATTERNS" "$file")
done < <(find "$ROOT" -name '*.md' -type f | sort)

LABEL=""; [ "$STRICT" = 1 ] && LABEL=", strict"
echo "--- 위반 ${viol}건, 예외 ${allow_hits}건 (루트 ${ROOT}${LABEL})"
[ "$viol" -eq 0 ] || exit 1
