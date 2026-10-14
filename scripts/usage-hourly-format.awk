# 사용량 출력 포맷: 상태 낱말과 퍼센트 중 강한 쪽으로 판정하고, 위험한 행을 위로 올린다.
# 판정 3=한도 도달(status=limit 또는 98% 이상) 2=초과·임박 1=여유·정상·미측정
# 변수: hour(KST 시) houru(UTC 시) dowu(UTC 요일) dowk(KST 요일)
function rank(s, p) {
  if (s == "limit" || p >= 98) return 3
  if (s == "over" || p >= 90) return 2
  return 1
}

/^[a-z0-9-]+: / {
  provider = $1; sub(/:$/, "", provider)
  if (provider == "opencode-go") provider = "go"
  else if (provider == "ollama-pro") provider = "ollama"
  next
}

/usage_status=/ {
  window = $2; if (window == "") window = "?"
  status = $0
  sub(/.*usage_status=/, "", status); sub(/[ \t\r].*$/, "", status)
  pct = -1; rst = "?"
  for (i = 1; i <= NF; i++) {
    if ($i ~ /^percent=/) { pct = $i; sub(/^percent=/, "", pct); pct += 0 }
    if ($i ~ /^reset_in=/) { rst = $i; sub(/^reset_in=/, "", rst) }
  }
  # 5h 창이 위험하면 같은 공급자의 주간 행에 마커를 붙인다(5h->w, g-5h->g-w).
  is5h = (window ~ /5h$/)
  if (is5h && rank(status, pct) >= 2) { key = window; sub(/5h$/, "w", key); h5[provider SUBSEP key] = 1 }
  # 5h 행은 상태와 무관하게 항상 보여준다. 다른 행은 상태가 알려졌거나 90% 이상일 때만 보여준다.
  known = (status == "under" || status == "optimal" || status == "over" || status == "limit")
  if (!is5h && !known && pct < 90) next

  n++
  prov[n] = provider; win[n] = window; pc[n] = (pct < 0 ? "?" : pct "%")
  rs[n] = rst; sv[n] = rank(status, pct); nt[n] = ""
  if (sv[n] == 3) { ic[n] = "🚨"; nt[n] = " 한도 도달" }
  else if (status == "over") ic[n] = "🔥"
  else if (sv[n] == 2) { ic[n] = "🟡"; nt[n] = " 한도 임박" }
  else if (status == "under") ic[n] = "🟢"
  else if (status == "optimal") ic[n] = "✅"
  else ic[n] = "⚪"
  if (length(provider) > wprov) wprov = length(provider)
  if (length(window) > wwin) wwin = length(window)
  if (length(pc[n]) > wpct) wpct = length(pc[n])
  if (length(rst) > wrst) wrst = length(rst)
  next
}

END {
  # 위험한 행을 먼저, 같은 등급이면 퍼센트가 높은 순.
  for (i = 2; i <= n; i++)
    for (j = i; j > 1; j--) {
      if (sv[j] > sv[j-1] || (sv[j] == sv[j-1] && pc[j] + 0 > pc[j-1] + 0)) {
        t = prov[j]; prov[j] = prov[j-1]; prov[j-1] = t
        t = win[j]; win[j] = win[j-1]; win[j-1] = t
        t = pc[j]; pc[j] = pc[j-1]; pc[j-1] = t
        t = rs[j]; rs[j] = rs[j-1]; rs[j-1] = t
        t = sv[j]; sv[j] = sv[j-1]; sv[j-1] = t
        t = ic[j]; ic[j] = ic[j-1]; ic[j-1] = t
        t = nt[j]; nt[j] = nt[j-1]; nt[j-1] = t
      } else break
    }
  for (i = 1; i <= n; i++) {
    extra = ""; k = prov[i] SUBSEP win[i]
    if (k in h5) { extra = " ⛔5h한도"; h5shown[k] = 1; nt[i] = "" }
    line = sprintf("%s %-*s | %-*s | %*s | %-*s%s%s", ic[i], wprov, prov[i], wwin, win[i], wpct, pc[i], wrst, rs[i], extra, nt[i])
    sub(/ +$/, "", line); print line
  }
  for (k in h5)
    if (!(k in h5shown)) { split(k, a, SUBSEP); printf "⛔ %-*s | %-*s | 5h 한도 도달\n", wprov, a[1], wwin, a[2] }
  if (n) print ""

  # 주말은 두 기준(UTC·KST)을 병행 표시. 공급자 요금은 UTC 주말이 사실상의 근거다.
  if (dowu >= 6) {
    print "🏖️ 주말 off-peak 상시 | ollama-cloud·opencode-go | 24시간 off (UTC 주말)"
    if (dowk >= 6) print "📅 KST도 주말 | 오늘 KST 기준 주말 — 두 기준 일치"
    else print "📅 KST는 평일 | 요금 주말(UTC)은 토 09:00 KST에 시작·월 09:00 KST에 끝남"
    print "📅 평일 시간표 | ollama-cloud | off-peak 03:00–21:00 KST"
    print "📅 평일 시간표 | opencode-go | off-peak 19:00–익일 10:00 KST"
  } else if (dowk >= 6) {
    print "🏖️ KST만 주말 | 요금 주말(UTC)은 아직 — 평일 기준 적용 중"
    print "📅 평일 시간표 | ollama-cloud | off-peak 03:00–21:00 KST"
    print "📅 평일 시간표 | opencode-go | off-peak 19:00–익일 10:00 KST"
  } else {
    if (hour >= 3 && hour < 21) print "⏩ 진행 중 | ollama-cloud | 종료 21:00 KST (평일 03:00–21:00)"
    else if (hour < 3) print "⏳ 대기 중 | ollama-cloud | 다음 시작 오늘 03:00 KST (평일 03:00–21:00)"
    else print "⏳ 대기 중 | ollama-cloud | 다음 시작 내일 03:00 KST (평일 03:00–21:00)"
    if (hour >= 19) print "⏩ 진행 중 | opencode-go | 종료 내일 10:00 KST (평일 19:00–익일 10:00)"
    else if (hour < 10) print "⏩ 진행 중 | opencode-go | 종료 10:00 KST (평일 19:00–익일 10:00)"
    else print "⏳ 대기 중 | opencode-go | 다음 시작 오늘 19:00 KST (평일 19:00–익일 10:00)"
  }
}
