# Free 매칭·리뷰어 연결·파레토 누락 수정 분배

- 사용자: 확인된 내용을 분배하여 진행. 기준 HEAD 9c900aa, 기존 감사 문서 7개 untracked 보존.
- 가용 w1 Muse Spark xhigh(w18:p2), w3 MiniMax max(w18:p4). w2/r missing, 세션 변경 없음.
- root는 분배·통합, w1/w3는 서로 상대 구현 독립 리뷰. 소유 외 파일 수정 금지.

| 담당 | 구현 | 소유 범위 |
| --- | --- | --- |
| w1 | 검증 Free 별칭 매칭 + Free 리뷰어 열/입력 인터페이스 | model-aliases.ts, letter-markdown-free*.ts, letter-markdown.ts, Free 회귀 tests |
| w3 | 리뷰어 파레토 계산 + 다음 단계 composition 배선 | letter-reviewer-candidates.ts, insights-reviewer-candidates.ts, 신규 reviewer-pareto 모듈·tests |

## A: Free 근거 매칭 (w1)

- 공식 verified Free 모델의 -free ID와 해당 AA base ID를 연결한다.
- DeepSeek/GLM/MiMo 실제 공식 목록을 fixture로 사용. MiniMax 기존 동작 유지.
- 임의 미확인 -free 모델을 무료로 승격하거나 unrelated 모델을 합치지 않는다.
- paid/Free 같은 AA 입력에서 AA 지수·effort 근거가 사라지지 않는 회귀 검증.

## B: Free 리뷰어 표시 인터페이스 (w1, 이 계약 고정)

- `letter-markdown-free-sort.ts`에 `FreeReviewerEntry` export:
  `{ readonly modelId: string; readonly score: string; readonly passed: boolean; readonly isPareto?: boolean }`.
- `MarkdownLetterInput` 및 `MarkdownLetterData`에 `freeReviewer?: readonly FreeReviewerEntry[]` 추가·전달.
- renderFreeSectionMarkdown의 기존 인자를 보존하고 끝에 freeReviewer 선택 인자 추가.
- freeReviewer === undefined이면 기존 2역할 표 유지. [] 이상이면 오케/리뷰어/워커 순서 3역할 표.
- 모든 역할의 완전한 근거 있는 점수만 표시, undefined는 '-'로 유지. 점수 생성/추정 금지.
- verified Free 카탈로그에 존재하는 행만 reviewer 병합. reviewer-only 근거 행도 Free 모델이면 허용.
- 모델당 1행, Free 경로 체크·calibration 숨김·기존 셀 유지. validator의 허용 헤더도 확인.

## C: 리뷰어 파레토 (w3)

- 기존 scoreRoleCandidatesFromSources 방식과 같은 두 축: reviewer score 높음 + 실제 비용 낮음.
- 비용은 해당 대표 variant의 effectiveCost ?? blendedCost 원값. 정규 price는 역방향이므로 비용처럼 비교 금지.
- score와 cost 둘 다 유한하며, 다른 후보가 score>=·cost<=이고 한쪽 strict이면 지배됨.
- cap 적용·base dedupe 후 전체 적격 reviewer 후보에서 계산(Top7/15 컷 전).
- 결측 비용은 비파레토, 동점 둘 다 비지배, 입력 순서 영향 없음. 점수·순위 불변.
- renderer는 이미 isPareto 지원: 전달만 보강. 기존 weights·ban·effort 정책 변경 없음.
- 이전 진단의 원시AA cutoff/정규price 비교 설명은 실제 코드와 대조해 그대로 복사하지 않는다.

## D: 다음 배선 단위 (w3가 초안, root 승인 계약 후 계속)

- B 완료 후 composition에서 buildReviewerCandidates의 full eligible reviewer를 사용해
  official Free 모델에 해당하는 score/pareto를 FreeReviewerEntry로 전달한다.
- 3역할 활성일 때만 freeReviewer 배열 주입, 비활성 기존 출력 보존.
- 본문/댓글 Top15·Free 실제 CLI 경로까지 검증. insights→composition 역의존 금지.

## 검증·리뷰·기록

- 5분 이내 구현/집중검증 단위. 긴 전체 check는 백그라운드 실행, 고정 sleep·불필요 재실행 금지.
- 각 파일 100줄, README/AGENTS 미수정. 확장 필요 파일은 root에 먼저 보고.
- 전체 check는 통합 최종 tree에서 1회, validate-repo.py 및 diff --check 포함.
- 완료 보고에 파일·검증 명령/exit·한계·다음 패킷 초안 작성. 수정→타 워커 리뷰 PASS 후 요청 파일만 커밋.
- push·발행·실계정/모델 호출·Free 실측·기준 완화 없음. 외부 쓰기 없이 docs에 기록.

## E: 표시 안내 정리 (추가 사용자 요청)

- 실제 3역할 표·주석·Free 표에 표시되지 않는 안내 항목 제거.
- 주 후보: 0~100 차원열, 가격 대체 *·99, 가산 +N, 미표시 ▽/접근 잠금 등.
- 실제 쓰이는 summary 변동 기호·파레토·Free 체크·의견 주석 출처는 유지.
- 계산 공식/선정 기준 변경으로 처리하지 않는다. 출처 및 산출 공식 블록은 보존.
- 기존 2역할 출력에서 아직 사용하는 범례는 무조건 삭제하지 않고 활성 3역할에 맞춘 안내를 연결.
- 배선/표시 안내는 w3 후속 단위에서 소유 파일을 확정해 배정, 현재 구현 파일과 충돌 없음.

## 2단위 소유

- w1: w3 파레토 독립 리뷰 및 표시 안내 정리. w3: w1 Free 독립 리뷰 및 composition 실제 배선.
- FreeReviewerEntry.modelId는 기존 Free 행과 같은 공식 catalog ID(-free 포함), score/pareto는 full eligible reviewer 원값.
- 3역할 on에서만 freeReviewer 주입([] 포함), off면 기존 출력. publish 및 once --markdown 검증.
- reviewer 입력으로 non-Free 행을 at(id,[])로 무조건 생성하지 않는지 검증. 문제는 소유자에게 보고.
- 안내 정리는 3역할에만 적용, 산출 공식/출처/정성 의견 근거 보존, 2역할 안내 유지.
- 통합 상호 리뷰 및 전체 check 1회 후 요청 파일만 커밋.

## 통합 재현: 접근 판정 canonical 불일치

- buildReviewerCandidates({records: 합성 4모델 AA+speed+가격, freeCatalog: officialFreePlans(...)})에서
  DeepSeek/GLM/MiMo/MiniMax가 모두 inaccessible-catalog로 제외되는 교차 경로를 root가 재현.
- accessibleRecords가 -free 카탈로그 ID로 매핑되는데 variants의 base ID와 직접 비교하는지 확인.
- w3 배선 단위의 추가 소유 허가: composition/insights-reviewer-candidates.ts, tests/insights-reviewer-composition.test.ts.
- 접근 판정도 동일 resolver로 canonical 기준 통일, verified gate 보존. 임의 -free 무료 승격 금지.
