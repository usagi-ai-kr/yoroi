# v1.0.3 릴리스 후보 및 글로벌 설치 스크립트 최종 리뷰

## 1. 리뷰 개요 및 결론
- **대상**: `/tmp/yoroi-103-final-clean` (Base: main `adea4d33868b6b40219fdf4da06de1e0e637a2d2`)
- **매니페스트**: `/tmp/yoroi-103-final-manifest.json` (6개 파일)
- **최종 판정**: **PASS (블로킹 이슈 없음, 릴리스 진행 승인)**
- **평가**: 워커 effort 라벨 1줄 최소 패치로 raw score에 일절 영향을 주지 않으면서 AA Max(39.5)와 표 라벨의 정합성을 완전히 회복함.

## 2. 매니페스트 및 변경 범위 검증
1. **버전 및 파일 (6개 파일만 변경 확인)**:
   - `package.json`: 1.0.2 → 1.0.3 패치 버전 승격
   - `src/insights/letter-top10-score.ts`: Line 43 정확히 1줄 최소 패치 (100줄 한도 준수)
   - `tests/insights-worker-effort-label.test.ts`: 신규 3개 좁은 회귀 테스트 (35줄)
   - `docs/release-status.md`: 1.0.2 발행 완료 및 1.0.3 후보 반영 (64줄)
   - `docs/tasks.md`: 1.0.3 작업 추적 갱신 (47줄)
   - `docs/insights/release-103-effort-fix-candidate.md`: 1.0.3 후보 설명 문서 (27줄)
2. **미포함 검증**:
   - ROOT의 dirty 5개 파일(기타 1.1 실험용 코드·문서·테스트)은 일절 포함되지 않고 원본 보존됨.

## 3. 검증 및 테스트 결과
- **3개 신규 회귀 테스트 (`tests/insights-worker-effort-label.test.ts`)**: 전수 PASS (exit 0)
  - ① AA에 chosen 존재 시 라벨 유지 (`gpt-6-1-sol` → `medium`)
  - ② AA에 chosen 부재 시 AA fallback effort 정합 (`deepseek-v4-1-flash` → `max`, 39.5)
  - ③ AA 근거 전무 시 intel 하한 정책 정상 동작 (목록 미등재)
- **단위 테스트**: 1063/1063 PASS (`/tmp/yoroi-103-unit.log`)
- **BDD 테스트**: 45 시나리오 / 632 스텝 PASS (`/tmp/yoroi-103-bdd.log`)
- **타입체크 & 빌드**: exit 0 PASS (`/tmp/yoroi-103-typecheck.log`, `/tmp/yoroi-103-build.log`)
- **레포 검증**: PASS 713 files (`/tmp/yoroi-103-validate.log`)
- **렌더러 실측 Diff**: 정확히 1줄 변동 (`deepseek-v4-1-flash` effort `high` → `max`). 스코어(59.3), 4대 차원, 가산(+4.4), 순위(4위), 단가, 타 행 전부 100% 동일.

## 4. 글로벌 갱신 스크립트 독립 리뷰 (`/tmp/yoroi-103-update-global.sh`)
- **스크립트 길이 및 문법**: 88줄 (100줄 한도 준수), `bash -n` PASS
- **보안 및 안전성**:
  - `restore_env` 함수, 0600 권한 격리, `trap cleanup EXIT` 안전 복원 유지
  - `diff -qr "$STAGE/dist" "$IPATH/dist"` 전체 dist 비교 무결성 검증 유지
  - 버전 1.0.3 핀 (`EXPECT_VERSION="1.0.3"`)
  - 필수 마커 검증 (`orchValue`, `orchestrator: { performance: 0.70...`, `normalRankScores`, `argon`, `muse`, `warn`)
- **모의 검증**: `/tmp/yoroi-103-global-mock/run-mock.sh` 8개 합성 실패/성공 케이스 전수 PASS
