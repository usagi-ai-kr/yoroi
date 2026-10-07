#!/usr/bin/env bash
# Agent Skills 스펙 기반 스킬 검증기.
# 사용법: validate.sh <skill-dir> [max-lines]
#   max-lines: 스킬 내 모든 텍스트 파일의 최대 줄 수 (기본 500)
# 의존성: bash, awk, grep, wc (macOS/Linux 기본 도구)
set -u
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

dir="${1:-}"
max="${2:-500}"
[ -z "$dir" ] && { echo "usage: $0 <skill-dir> [max-lines]" >&2; exit 2; }
dir="$(cd "$dir" 2>/dev/null && pwd)" || { echo "ERROR: 디렉터리 없음: $1" >&2; exit 1; }
md="$dir/SKILL.md"
errs=0
err() { echo "ERROR: $*"; errs=$((errs + 1)); }
ok() { echo "ok: $*"; }

[ -f "$md" ] || { echo "ERROR: $md 없음"; exit 1; }
[ "$(head -n1 "$md")" = "---" ] || err "SKILL.md 첫 줄이 '---'가 아님"
awk 'NR>1 && /^---$/{closed=1; exit} END{exit !closed}' "$md" || err "frontmatter 닫힘 누락"

fm="$(awk 'NR==1{next} /^---$/{exit} {print}' "$md")"
[ -n "$fm" ] || err "frontmatter가 비어 있거나 닫히지 않음"

# key의 값 추출. 블록 스칼라(> |)면 들여쓴 줄을 이어 붙인다.
field() {
  printf '%s\n' "$fm" | awk -v k="$1" '
    $0 ~ "^"k":" { v=$0; sub("^"k":[ ]*", "", v)
      if (v ~ /^[>|][-+]?$/) { blk=1; v=""; next } print v; exit }
    blk && /^[ \t]/ { sub(/^[ \t]+/, ""); v = v (v=="" ? "" : " ") $0; next }
    blk { print v; exit }
    END { if (blk) print v }'
}
unquote() { local s="$1"; s="${s#[\"\']}"; s="${s%[\"\']}"; printf '%s' "$s"; }
chars() { printf '%s' "$1" | wc -m | tr -d ' '; }

name="$(unquote "$(field name)")"
e0=$errs
if [ -z "$name" ]; then err "name 누락"
else
  n=$(chars "$name")
  [ "$n" -le 64 ] || err "name 길이 $n > 64"
  printf '%s' "$name" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$' \
    || err "name '$name' 형식 위반 (a-z0-9-, 앞뒤/연속 하이픈 금지)"
  [ "$name" = "$(basename "$dir")" ] || err "name '$name' ≠ 디렉터리명 '$(basename "$dir")'"
  [ $errs -eq $e0 ] && ok "name: $name"
fi

desc="$(unquote "$(field description)")"
if [ -z "$desc" ]; then err "description 누락"
else
  n=$(chars "$desc")
  [ "$n" -le 1024 ] && ok "description: ${n}자" || err "description 길이 $n > 1024"
fi

comp="$(field compatibility)"
if printf '%s\n' "$fm" | grep -q '^compatibility:'; then
  n=$(chars "$(unquote "$comp")")
  [ "$n" -ge 1 ] && [ "$n" -le 500 ] || err "compatibility 길이 $n (1-500)"
fi

# 파일별 줄 수
e0=$errs
while IFS= read -r f; do
  grep -Iq . "$f" 2>/dev/null || continue  # 바이너리/빈 파일 제외
  l=$(awk 'END {print NR}' "$f")
  [ "$l" -le "$max" ] || err "${f#$dir/}: ${l}줄 > ${max}"
done < <(find "$dir" -type f)
[ $errs -eq $e0 ] && ok "줄 수 검사 (max $max)"

# SKILL.md 상대경로 링크 존재 여부
while IFS= read -r p; do
  case "$p" in http*|\#*|mailto:*) continue ;; esac
  p="${p%%#*}"
  [ -e "$dir/$p" ] || err "링크 대상 없음: $p"
done < <(grep -oE '\]\([^)]+\)' "$md" | sed -E 's/^\]\((.*)\)$/\1/')

if command -v skills-ref >/dev/null 2>&1; then
  skills-ref validate "$dir" || errs=$((errs + 1))
fi

[ $errs -eq 0 ] && { echo "PASS: $dir"; exit 0; }
echo "FAIL: $dir ($errs errors)"; exit 1
