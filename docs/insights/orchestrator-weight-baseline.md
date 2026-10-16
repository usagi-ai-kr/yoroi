# 오케스트레이터 가중치 기준선 (#160, 2026-10-15)

## 출처
- 게시 #160 1회 GET (행·Free표·라벨 확인). 코드 v1.0.1 clean `c7c403ee`.
- 고정 입력: `scratch/reports/yoroi-grok46-public-input.json` (sha256 `879e5051…`, 18k행).
- 고정 파일: `scratch/reports/yoroi-orch-160-input.json` (free·nowUtc·가격·ranks·제외·캐시·held·effort·가중치).

## 재현 가능 여부
- 재렌더는 소속 20/20 일치. fresh Free(12/2)로 전행 바이트 동일 → 대조군 동결 (게시 당시 raw 아님, provenance 구분).
- live Free 12종/2플랜의 modelId·verified는 본문에서 복원 불가라 발명하지 않았다.
- runner: `node --import tsx /tmp/yoroi-101-letter-render.mjs <clean> <snapshot> <out>`.

## 미해결 한계
- Free 증거행의 점수 영향은 미입증. nowUtc는 양쪽 off-peak로 제외.
- 게시 스코어(96.4·89.4·86.4·78.1·74.9·74.0·70.7·70.7·69.7·66.8)를 기준으로 삼는다.
- 워커 30/20/10/40+가산 5는 고정해 후보 간 불변을 검증한다.

## 인터페이스
- `computeRoleTop10` · `renderTop10MarkdownFromRecords` · `scoreRoleCandidatesFromSources` · `buildCandidatePool`.

## 현재 정책 (R 1.0.2 준비)
- 이 기준선의 82/6/12 raw 수치는 **역사 실험 기록**이다. 사용자 확정은 R 오케 70/5/10/15 + `I/(P+.01)` + 정규 순위 표시. 아직 Release 미발행.
- 현재 정책: [score-weights.md](score-weights.md)·[role-score-product-verification.md](role-score-product-verification.md).
