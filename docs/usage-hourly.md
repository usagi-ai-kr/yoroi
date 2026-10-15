# 매시간 사용량 보고

- 크론 `yoroi-usage-hourly`(매시 45분)가 프로필 래퍼 `~/.hermes/profiles/kodetsu/scripts/yoroi-usage-hourly.sh`를 실행하고,
  래퍼는 이 레포의 `scripts/usage-hourly-report.sh`를 호출한다. 로직은 레포에만 있다.
- 실행 순서
  1. 전역 CLI 스냅샷이 레포 버전과 어긋나면 `pnpm run update:global`로 다시 설치한다.
  2. `yoroi once`로 사용량을 조회한다.
  3. `scripts/usage-hourly-format.awk`로 표시를 만든다.
- 레포 워킹트리를 직접 실행하지 않는다(`pnpm run dev`를 쓰지 않는다). 편집 중인 소스가 보고에 섞이지 않게 하기 위해서다.
- 실패 처리: 갱신에 실패하면 이전 스냅샷으로 계속 보고하며 한 줄 경고를 낸다. 조회가 실패하면
  `⚠️ 조회 실패 | yoroi | …` 한 줄을 출력한다. 빈 출력으로 조용히 넘어가지 않는다.
- 출력은 볼드 같은 마크다운을 쓰지 않는다. 폭 맞춤이 필요한 표는 공급자 메시지에서 고정폭으로 보이도록
  **코드 블록으로 감싸서** 낸다(스크립트가 펜스를 직접 넣는다). 출력이 비면 아무것도 내지 않는다.
- 표시 규칙: 상태 낱말과 퍼센트 중 **강한 쪽**으로 판정한다.
  - 98% 이상 또는 `usage_status=limit` → 🚨 `한도 도달`
  - 90% 이상인데 상태가 `n/a` → 🟡 `한도 임박`
  - `over` → 🔥, `under` → 🟢, `optimal` → ✅, 그 밖 → ⚪
  - 위험한 행을 위로 올리고, 같은 등급이면 퍼센트가 높은 순으로 정렬한다. 퍼센트는 오른쪽 정렬,
    리셋 열까지 폭을 맞춰 뒤에 붙는 마커가 같은 위치에 온다.
  - 5h 창은 상태와 무관하게 항상 표시하고, 그 5h 창이 위험하면 같은 공급자의 주간 행에 `⛔5h한도`를 붙인다.
  - xAI `weekly` 창은 상태가 `n/a`여도 표시한다. 사용률이 없으면 `?`로 두고 `reset_in`은 그대로 표시한다.
  - 이 예외는 xAI 주간 창에만 적용한다. 다른 공급자의 `n/a` 창은 기존처럼 숨긴다.
- 환경변수: `YOROI_REPO`(레포 경로) `YOROI_CLI`(조회 명령, 기본 `yoroi once`) `YOROI_SKIP_UPDATE=1`(스냅샷 갱신 생략)
  `YOROI_CODE_FENCE=0`(코드 블록 감쌈 끄기) `TZ`.
- 검증: `YOROI_SKIP_UPDATE=1 YOROI_CLI="cat <가짜입력>" bash scripts/usage-hourly-report.sh`로
  상태·퍼센트 조합별 이모지와 정렬을 확인한다.
