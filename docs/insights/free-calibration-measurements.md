# Free 캘리브레이션 실측 (2026-10-20, #180)

> **현재 상태: 무효 측정(점수 없음).** 아래 '측정값' 절의 45/100·`not_recommended`는 모델 점수가 아니라
> v2 CLI 호출 실패(인프라 오류)다. 유효한 실측은 아직 없다. 정정 근거는 '정정' 절.

- 모델: `opencode-go/minimax-m3.1-flash-free` (정규화 `minimax-m3-1-flash`).
- task-set v2, 1회 실행 (`--runs 1 --yes`), 격리 데이터 dir (repo 밖 `/tmp/yoroi-180/data`).
- 실행 ID: `calib-1792483400257-c0aecccb` (2026-10-20T08:03Z).

## 측정값 (실측이나 무효 — 아래 정정 참조)

- 총점 45/100, 판정 `not_recommended`, 표본 `provisional` (1회). **무효(인프라 실패).**
- task-1 (packet-compliance): 45점, 미통과. task-2 (single-file-edit): 45점, 미통과.
- task-3 (test-fix): 45점, 미통과. task-4 (scope-safety): 45점, 미통과.
- 중대 위반 없음. 재시도 0회. 지연 43–478ms (빠른 실패 패턴).
- 프롬프트·응답 전문·원본 로그는 기록하지 않는다 (DB에 점수·메타만).

## 해석 규칙 (#180 본문 기준)

- 1회 실행은 잠정치다. 안정 판정은 동일 task-set 3회 중앙값을 쓴다.
- 표본 부족을 모델 무능력으로 단정하지 않는다. 다음 단위에서 2회 추가 실행이 필요.
- 쿼터는 불명 (수치 미공개). 쿼터 부족은 측정 부족이지 모델 무능이 아니다.

## 정정 (CRITICAL): 45점은 무효 측정이다

- 2026-10-20 3회 45점은 모델 점수가 아니다. 원인은 `opencode run` 호출이
  v2에서 없는 `--max-turns/--max-tokens/--dir` 플래그를 써서 사용법 오류로
  즉시 종료된 것이다 (평균 지연 수십 ms가 증거).
- 해당 점수·`not_recommended` 판정은 모두 무효이며 측정 부족으로 되돌린다.
  안정 판정이라는 이전 보고도 정정한다.
- 수정: v2 유효 호출 (positional 메시지 1회 + 샌드박스 cwd), nonzero 종료는 `CalibrationLaunchError`로 점수 없이 실패 처리.
- 잔여 한계: 진짜 cwd 격리는 `ProcessRequest.cwd` 지원으로 해소(샌드박스 디렉터리에서 실행).
  파일 과제는 cwd 격리 + 절대경로 전제 + checker 검증으로 측정한다.

## Actions 실발행 전제 점검 (발행 없음)

- 워크플로 `letter-publish` active, Secrets 2종 존재 (이름만 확인).
- 스케줄 실행 기록 없음. dry-run은 duplicate 경로만 검증됨.
- fresh `workflow_dispatch`는 별도 단위에서 수행. 본 단위 dispatch 없음.
