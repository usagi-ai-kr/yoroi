# 후속 단위 2 (2026-10-20)

현재 요청: 앞서 분배한 작업을 이어서 진행. 세 기존 패널 모두 idle 및 보고서 도착 확인.
이전 소유 파일은 그대로 보존. 새 단위는 아래 범위만 수행한다.

## w1 — PR #191 CI 테스트 경로 수정

소유: tests/insights-calibration-cli.test.ts,
tests/insights-calibration-store-open-failure.test.ts(필요시 신규),
docs/insights/calibration-ci-portability.md.
- /proc/invalid 하드코딩을 제거한다. mkdtemp 하위 일반파일을 만들고 그 아래
  디렉터리를 열게 해 ENOTDIR 등 결정적 실패를 검증한다. 권한/root/OS 의존 금지.
- 기존 fresh DB 저장 검증을 보존한다. 선언만 한 runner.runs=0은 실행 차단 증거가
  아님을 바로잡고, 필요하면 실제 main 자식 실행을 timeout으로 제한해 실패 exit1 확인.
- 실모델·실계정·공급자CLI 실행 금지. 새 경로가 실패 전제임을 실제 검증한다.
- CI 취소 로그와 경로 관련 원인 추정/확정은 구분. Linux 미검증을 통과로 쓰지 않는다.
- 집중 테스트와 최종 전체 pnpm run check·레포검증·diff --check. 파일100줄 이하.

## w2 — Arena 단위A 및 #168 설계 독립 리뷰

소유: docs/insights/arena-discovery-review-20261020.md만. 코드수정 금지.
- w1의 Arena 5파일과 보고서, w3 설계 문서 대조. 공식 HF 문서/스키마의
  실제 출처 URL과 조회 근거를 확인. 이전 카드 봤다는 주장만으로 스키마 승인 금지.
- agent 전체가 명시적 코딩인지, webdev rating vs agent IPS 수치 의미 구분,
  날짜형 모델 ID 충돌/다중서브셋 보존·비정상입력·유사명 무병합을 확인.
- 발견한 차단 문제는 파일/줄·재현입력·필요한 최소수정을 명시. 범위확대 금지.
- #168 설계의 기존결정과 신규제안/미확인 구분(특히 공식API 전부인증 등 단정)을 검토.
- 관련 집중검증 실행. 마지막 전체check는 w1 단위에 맡겨 중복하지 않는다.

## w3 — #168 순수 레지스트리 핵심 구현

소유: src/insights/model-discovery-types.ts, model-discovery-diff.ts,
model-discovery-eligibility.ts, model-discovery-snapshot.ts, model-discovery-render.ts
(모두 src/insights/ 접두), tests/insights-model-discovery.test.ts,
tests/insights-model-discovery-snapshot.test.ts, docs/insights/model-discovery-unit2.md.
- 단위1의 순수 타입·정확ID diff·후보 적격 게이트·snapshot선택·stdout 렌더 구현.
- provider별 분리, ID 중복/미검증/날짜오류/티어effort누락 fail-closed.
- verified=true는 입력의 공식검증 사실을 보존할 뿐 자동 부여하지 않는다.
  URL 모양만으로 공식확인을 대체하지 않는다. 신뢰경계를 문서화한다.
- 수집실패시 last-good 보존, 30일 만료/미래시각/정확경계 검증.
  중복/순서만 다른 목록은 허위변경으로 알리지 않는다.
- schema·API·provider어댑터·저장소·config파일·기존catalog·once·레터 연결은 미구현.
- 폐지 grace·새설정 의미·가중치 등 미결 정책 결정 금지. 순수계약으로 제한.
- 합성 fixture 집중 테스트·typecheck·레포검증·diff --check. 파일100줄 이하.

## 공통

- 서브에이전트·모델/세션변경·commit/push/PR·실모델호출 금지.
- 5분 단위 진척/남은일 기록. 보고서는 패킷 report_path 사용.
- 통과한 결과는 구현자와 다른 패널이 최종 리뷰하고 총괄이 커밋한다.
- 이슈 전체완료나 원격CI통과를 선반영하지 않는다.
