# 1.0.2 릴리스 레터 발행 준비 보고 (w2)

- 작업 ID: `yoroi-102-letter-prep-w2`
- 산출물: `/tmp/yoroi-102-letter-preview.md`, `/tmp/yoroi-102-letter-provenance.json`
- 현 작업 단위: 발행 준비 및 검증만 수행 (실제 배포·게시는 Release 및 main SHA 검증 후 후속 패킷 진행)

## 1. 발행 관행 및 중복 방지 절차

- **기존 레터 상태**:
  - 당일 이슈: [#162 ([letter] 2026-10-16 AI 인사이트 레터)](https://github.com/qus0in/yoroi/issues/162) `OPEN` (09:00 자동 발행본).
  - 전일 이슈: [#160 ([letter] 2026-10-15 AI 인사이트 레터 (Grok 4.6))](https://github.com/qus0in/yoroi/issues/160) `CLOSED`.
- **중복 방지 메커니즘**:
  - `yoroi insights publish`는 당일 동일 제목 이슈(#162)가 존재하면 `skip: already published #162`를 출력하고 종료함.
  - 1.0.2 산식(선형 R, 정규 50 스코어) 및 카탈로그 변경 반영본을 게시하려면 2026-10-14 p85 수동 발행 관행을 따라 `[letter] 2026-10-16 AI 인사이트 레터 (1.0.2)`로 신규 게시 후 기존 #162를 닫거나 안내 댓글을 부착하는 절차 적용 예정.
- **실제 발행 타이밍**:
  - dev → main PR 머지, main CI 성공, GitHub Release 1.0.2 발행 및 전역 CLI 갱신 완료 후 공식 전역 명령 또는 검증된 main SHA 소스로 게시.

## 2. 렌더링 검증 및 신규 카탈로그 모델 상태

- **공식 렌더러 실행**:
  - `node --import tsx src/main.ts insights once --markdown`을 통해 저장된 공공 벤치마크 스냅샷 기반으로 본문 생성 완료.
  - 선두 모델: 오케스트레이터 `claude-opus-5-5` (72.4) · 워커 `gpt-6-luna` (69.6).
- **카탈로그 신규 모델 표 노출 구분**:
  - `gemini-4-argon`: Antigravity 플랜 verified + AA Intel 52.6 측정 근거 존재 → **오케스트레이터 6위(60.9) 정상 노출**.
  - `muse-spark-open`: Ollama Cloud Pro 플랜 verified 등재 완료되었으나 공개 벤치마크 evidence 부재 → **Top10 자동 편입 없이 정상 제외 유지**.
- **워커 및 산식 보존**:
  - 워커 가산(+N), R 산식, 정규 50 중심 순위 보정, 파레토, Free 티어 표(9종) 정상 렌더 확인.

## 3. 보안 및 데이터 무결성

- 개인 사용량 원본, 토큰, env, 비밀값 일체 미포함 (공공 벤치마크 및 카탈로그 메타데이터만 활용).
- 불필요한 실 API 호출 없음.
- 본 단위에서는 소스코드, Git, GitHub 이슈 상태 변경 없음.
