# v1.0.2 인사이트 레터 클린 프리뷰 및 검증 보고

## 1. 개요 및 산출 환경
- **작업 ID**: `yoroi-102-letter-clean-w2`
- **기준 베이스**: `9cd019015a680e0e57bdc1ac3b1df14bb368f074` (origin/main)
- **산출 소스**: `/tmp/yoroi-102-final-clean` (ROOT의 미커밋 1.1 worker effort hunk 완전 배제)
- **스냅샷 일시**: 2026-10-16T00:00:01~04Z 공공 벤치마크 4종(AA, OR, OCD, Cog)
- **하드코딩 배제**: 실측 메타데이터 및 정식 `insights once` 렌더러 기반 자동 산출

## 2. 주요 모델 검증 결과
- **선두 모델**:
  - 오케스트레이터·리뷰어: `claude-opus-5-5` (스코어 72.4, effort medium)
  - 워커·메신저: `gpt-6-luna` (스코어 69.6, effort max)
- **Gemini 4 Argon (`gemini-4-argon`)**:
  - AA 공식 지표: Intelligence Index 52.6, 가격 input $2 / output $10 (혼합 $4.00/1M)
  - 플랜 접근: `Antigravity` (검증 완료)
  - 오케스트레이터 6위 (스코어 60.9, effort high) 정상 랭크 확인
  - 과거 미측정/OR-only 조사와 달리 2026-10-16 공공 스냅샷에 정식 등재되어 반영됨
- **Muse Spark Open (`muse-spark-open`)**:
  - 플랜 접근: `Ollama Cloud Pro` (카탈로그 검증 완료)
  - 벤치마크: OR/OCD/Cog 내 evidence 부재 및 AA 단독 38.9점으로 Top10 컷오프 미진입 정상 유지
- **DeepSeek V4.1 Flash (`deepseek-v4-1-flash`)**:
  - ROOT의 미커밋 1.1 worker hunk(aaFallback) 배제 결과, 정상 `effort high`로 산출 (워커 4위, 스코어 59.3)

## 3. 출력 규격 및 예산 검증
- **가중치 정책**:
  - 오케스트레이터: 성능 70% / 사용량 5% / 속도 10% / 가성비 15%
  - 워커: 성능 30% / 사용량 20% / 속도 10% / 가격 40%
- **출력 길이 및 예산**:
  - Full Markdown (`--markdown`): 6,684자 (전체 Free 티어 포함)
  - Compact 레터: 3,588자 (예산 3,600자 엄격 충족, Free 티어 생략 fallback 정상 동작)
  - 행 수: 오케스트레이터 10행 + 워커 10행 = 총 20행

## 4. 정식 게시 및 후속 절차
- 현재 2026-10-16자 자동 생성 이슈 `#162`가 오픈 상태이므로 자동 중복 발행은 방지됨
- v1.0.2 main 머지 및 전역 CLI 갱신 후, 아래 명령으로 1.0.2 정식 레터를 게시하고 `#162`를 정리:
  ```bash
  gh issue create --title "[letter] 2026-10-16 AI 인사이트 레터 (1.0.2)" \
    --body-file /tmp/yoroi-102-letter-clean-preview.md
  gh issue close 162 --comment "v1.0.2 릴리스 공식 레터 게시로 대체 종료"
  ```
