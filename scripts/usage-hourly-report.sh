#!/usr/bin/env bash
# 매시간 사용량 보고: 전역 CLI 스냅샷을 최신으로 맞춘 뒤 조회하고 표시 형식을 적용한다.
# 해당 항목이 없으면 빈 출력 → 크론 침묵. 실행 실패는 조용히 넘기지 않고 한 줄로 알린다.
# env: YOROI_REPO(레포 경로) YOROI_CLI(조회 명령) YOROI_SKIP_UPDATE=1(스냅샷 갱신 생략)
set -uo pipefail
export PATH="${HOME}/Library/pnpm/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH}"
export TZ="${TZ:-Asia/Seoul}"

REPO="${YOROI_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CLI="${YOROI_CLI:-yoroi once}"
cd "$REPO" || { echo "⚠️ 조회 실패 | yoroi | 레포 경로를 찾지 못했다: ${REPO}"; exit 0; }

# 1) 스냅샷 갱신: 배포가 반영된 뒤에만 다시 설치한다.
#    지문은 package.json 버전 + origin/main SHA다. 워커가 편집할 때마다 갱신하지 않는다.
#    성공 문구는 실제로 갱신했을 때만 낸다(실패는 항상 알린다). 지문 파일은 레포 밖에 둔다.
STALE=""
if [ "${YOROI_SKIP_UPDATE:-0}" != "1" ]; then
  git -C "$REPO" fetch --quiet origin main 2>/dev/null || true
  ver="$(node -p "require('$REPO/package.json').version" 2>/dev/null || echo none)"
  main_sha="$(git -C "$REPO" rev-parse --short origin/main 2>/dev/null || echo none)"
  want="v${ver}+${main_sha}"
  fpfile="${YOROI_FINGERPRINT:-$HOME/.cache/yoroi/usage-hourly-fingerprint}"
  if [ "$want" != "$(cat "$fpfile" 2>/dev/null)" ]; then
    if pnpm --silent run update:global > /dev/null 2>&1; then
      mkdir -p "$(dirname "$fpfile")" && printf '%s' "$want" > "$fpfile"
      echo "🔄 전역 CLI 갱신 | yoroi | 배포 반영(${want})"
    else
      STALE="⚠️ 스냅샷 갱신 실패 | yoroi | 이전 스냅샷으로 보고한다 — 레포에서 pnpm run update:global 확인"
    fi
  fi
fi
[ -n "$STALE" ] && echo "$STALE"

# 2) 조회
RAW="$(mktemp)"
trap 'rm -f "$RAW"' EXIT
if ! bash -c "$CLI" > "$RAW" 2>&1; then
  echo "⚠️ 조회 실패 | yoroi | 조회 명령이 실패해 이번 회차 출력을 생략했다"
  exit 0
fi

# 3) 표시: 위험한 행을 위로, 퍼센트는 오른쪽 정렬, 리셋 열까지 폭을 맞춘다.
#    폭 맞춤은 고정폭 글꼴에서만 보이므로 코드 블록으로 감싼다(YOROI_CODE_FENCE=0으로 끔).
OUT="$(LC_ALL=C awk -v hour="$(date '+%H')" -v houru="$(TZ=UTC date '+%H')" \
  -v dowu="$(TZ=UTC date '+%u')" -v dowk="$(date '+%u')" \
  -f "$REPO/scripts/usage-hourly-format.awk" "$RAW")"
[ -n "$OUT" ] || exit 0

if [ "${YOROI_CODE_FENCE:-1}" = "1" ]; then
  printf '```\n%s\n```\n' "$OUT"
else
  printf '%s\n' "$OUT"
fi
