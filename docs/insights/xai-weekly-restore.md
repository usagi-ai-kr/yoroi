# xAI 주간 기본 표시 복원 (2026-10-15)

- 요청: 주간 xAI 행을 yo·yo2·hourly에 표시. 0.12.1 `dc11e8c` 기본 제외 결정을 변경한다.
- 기본 조회에 xai를 복원하고 명시적 YOROI_PROVIDERS 선택은 유지한다.
- hourly 로직은 레포에만 둔다. 프로필 래퍼 변경·워킹트리 직접 실행 금지.
- percent 부재 시 값을 만들거나 prepaidBalance를 주간 사용률로 해석하지 않는다.
- 주간 사용량 대체 근거를 확인하고 불가하면 weekly 행의 미제공 상태를 표시한다.
- 새 milestone·버전 승격·머지 승인 확장 없음. 개인 사용량 원본·토큰 비기록.

## 1단계 분배

| 담당 | 범위 | 소유 |
| --- | --- | --- |
| w1 | 기본 목록·단위/BDD | load-config·config 테스트·default-providers feature/steps·development.md |
| w2 | 신규 스키마·주간 행 계약 조사 | /tmp 보고서만; 코드 읽기 전용 |
| w4 | hourly 합성검증·표시 누락 조사 | usage-hourly 스크립트/awk·usage-hourly.md |
| w3 | 기존 Release 검증 중 | 이번 작업 미배정 |

- 보고: /tmp/yoroi-xai-{restore-default-w1,weekly-contract-w2,hourly-w4}-report.json.
- 5분 단위로 결과를 확인하고 파서 구현·교차 리뷰를 다음 단계에 배정한다.
- 작성자 외 워커가 리뷰한다. 커밋은 리뷰 후 허가된 변경만 묶는다.
- 최종: 단위·BDD·typecheck·build·validate-repo·합성 hourly 실행.
- 실제 조회는 최소 횟수, 결과는 행 존재·단위·상태 등 구조만 보고.
- 중단 시 새 작업을 멈추고 변경과 보고를 보존한다.

## 구현·리뷰 결과

- w1: 단일 기본 공급자 원본에 xai 복원, config·composition·BDD·도움말·개발문서 정정.
- w2: percent 부재 시 주간 기간·리셋만 보존. 합성 fixture 회귀 검증; 잔액을 사용률로 해석하지 않는다.
- w4: xAI weekly n/a는 yo에서 `w`, hourly에서도 `w`로 표시한다. 내부 ID `weekly`와 yo2 전체 표시는 유지한다.
- hourly의 비숫자 사용률은 `?`로 표시하며 0으로 바꾸지 않는다. 프로필 래퍼는 변경하지 않았다.
- 교차 리뷰: w1이 w2 파서·w4 표시 승인; w2가 w1 기본 복원 승인 및 최종 후속 확인 담당.
- 전역 갱신은 버전 승격 없이 현재 검증된 스냅샷으로 수행한다. 새 PR 머지·Release는 별도다.
- 주간 퍼센트 대체 경로 조사는 미확정으로 종료했다. 현재 서버의 percent 미제공을 명시한다.
- source 재적용: W2 승인 뒤 update:global로 0.13.2 전역 CLI를 갱신하고 설치 dist의 xAI weekly→w 매핑을 확인했다. 실 API 조회는 없다.

## 전역 반영 확인

- 현재 검증 트리를 전역 0.13.2 스냅샷으로 갱신했고 설치 dist가 빌드와 동일하다.
- 실제 yo·yo2·레포 hourly 실행에서 모두 xai weekly 행을 확인했다.
- 현재 서버의 사용률 미제공은 pretty `n/a`, hourly `?`로 표시하며 리셋 정보는 보존한다.
- 최종 typecheck·단위 1017/1017·BDD 45/45·build·validate-repo 통과.
- 버전·tag·Release·마일스톤 변경 및 main 머지는 하지 않았다.
