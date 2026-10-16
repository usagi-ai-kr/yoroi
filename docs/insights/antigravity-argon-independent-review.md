# Argon 카탈로그 독립 리뷰 (w3, yoroi-165-argon-independent-w3)

- 대상: w1 보고서 `/tmp/yoroi-165-argon-catalog-w1-report.json` + 실제 diff (읽기 전용).
- 본인 Muse 구현은 범위 제외(별도 리뷰 PASS). 보존 여부만 확인.
- 수정 0. docs/JSON만 작성.

## 공식 근거 직접 대조 (agy-dom.html, 14:13 캡처)

- 표 헤더: 모델 | 무료·Plus | Pro | Ultra | 엔터프라이즈. Argon 행: ❌·✅(각주)·✅·✅.
- 각주 **: 체험판 제외, 정식 구독만. 각주 ***: IDE 불가, App·CLI·확장 가능.
- 배너: Pro·Ultra용 Argon. w1 기록과 원문 일치. 과장 없음.
- CLI 접근권 판단: ***가 CLI를 명시 허용 → Yoroi CLI 수집 경로와 일치. IDE 제외는 별개.

## 항목별 판정

- `gemini-4-argon` 등재: verified true, sourceUrl docs/models, checkedOn 2026-10-16.
- free 미표기·usageLimit 미기재: 수치 없어 창작 금지 — cursor 선례와 동일. 정당.
- note(무료·Plus 불가, Pro 정식·Ultra·Enterprise, IDE 제외): **표만 정확히 옮김.
- 기존 날짜 불변: 2026-10-12/13/14 유지, 2026-10-16은 Argon·Muse 2건만.
- Muse 항목 바이트 동일 보존. 기존 dirty·라벨 `g-w-a` 미접촉(w1 목록 외 변경 없음).
- 카운트: ollama 19·antigravity 10 실측 일치. 플랜 내 중복 0(테스트 통과).
- 플랜 간 공유 ID 19건은 기존 설계(다플랜 노출), 결함 아님.
- OR-only AA 결측: candidates·score·policy 무수정(diff 확인). fixture 경로만 검증.
- 워커 AA33·가짜 성능 없음: 관련 파일 w1 미접촉. score diff는 기존 1.0.2 dirty.
- 등재 ≠ Top10 노출: 근거 행 추가 없음. 구분 유지.

## note 전파 확인

- `PlanModelEntry.note`를 읽는 소비자가 없음(판정: 기록 전용, 설계대로).
- 접근 열은 `Antigravity` 그대로. 티어 제한 표면화는 후속 패킷 과제(차단 아님).

## 검증 실측

- 관련 4파일 21/21 PASS (catalog 7·argon 3·aliases 7·muse-open 4).
- validate PASS (709 files). 전 파일 100줄 이하.
- typecheck: w1 범위 오류 0. 전체 실패 3건은 w2 진행 중 파일
- (`usage-warn-render.test.ts`, untracked·동시 편집 중) — w1 책임 아님, 분리 보고.

## 완료 판단

- 구현 승인 가능. close·병합은 사용자/오케 결정. 보고 후 대기.
