# 인사이트 레터 인수인계 ([#70](https://github.com/qus0in/yoroi/issues/70), 0.5.0)

계약: [execution-contract.md](execution-contract.md) 1-A·3-A·4-A·5-A·6-A·8-A 확정안따라
0.5.0 레터는 **내부 전용 stdout 발행**만 제공한다. 외부 발행 모드는 없고(6-A),
메시지 전송·cron/Hermes 등록·전달 대상 설정은 이 저장소가 하지 않는다.

## 명령

- `yoroi insights once` — 평문 레터 1회 발행 후 종료(기본).
- `yoroi insights once --pretty` — 한국어 레터(표 포함).
- `yoroi insights once --refresh` — 오늘 저장된 성공 스냅샷을 무시하고 재수집.
- `yoroi insights -h` · `yoroi insights --help` — 사용법(exit 0). 그 외 인자는 exit 2.
- 개발 실행: `pnpm run dev insights once --pretty`.

## 환경 변수(이름만, 값은 문서·로그·Git에 넣지 않는다)

| 변수 | 용도 |
| --- | --- |
| `YOROI_AA_API_KEY` | Artificial Analysis 인증(x-api-key). 없으면 해당 소스만 실패로 표시되고 나머지는 계속 |
| `YOROI_OPENROUTER_API_KEY` | OpenRouter 인증(bearer). 없으면 해당 소스만 실패로 표시 |
| `YOROI_DATA_DIR` | 로컬 데이터 디렉터리. 기본 `${XDG_DATA_HOME:-~/.local/share}/yoroi` |

Arena·Cognition은 키가 없다. 설정 오류(잘못된 값·중복 인자)는 exit 2, 소스 실패는 레터에
부분 실패로 남는다. 키는 실행 셸 환경 또는 로컬 `.env`에서만 읽는다.

## 출력과 종료 코드

- stdout에는 레터만 한 번 출력한다. stderr에는 `detect:` 형태와 동일하게 비밀값 없는
  진단만 나간다(메시지·경로·자격 증명 없음).
- 재실행해도 같은 날짜의 성공 레터를 그대로 stdout으로 다시 출력한다. "이미 전달됨"을
  이유로 출력을 비우지 않는다(4-A).

| 코드 | 의미 |
| --- | --- |
| 0 | 성공·부분 성공 |
| 1 | 전체 소스 실패(성공 레터 없음, stderr에만 진단) |
| 2 | 인자·설정 오류 |

## KST 일일 키·캐시·복구

- 일일 키는 `(source, KST 발행일, 비밀 없는 요청 범위, schemaVersion)`이다. 같은 날
  재실행은 저장된 성공 결과를 재사용하고(발행일·수집 시각은 유지), `--refresh`만 오늘
  성과를 교체한다. 하루가 바뀌면 새 키를 쓴다.
- 실패·전행 불완전 소스는 성공을 덮어쓰지 않고 다음 실행에서 다시 시도한다(4-A).
- 정규화 이력은 KST 발행일 기준 90일 보존하며 그 이전 일자는 가지치기한다.
- 원자료 기준일 미상(AA·Cognition)은 변화량을 `n/a: 기준일 미상`으로 표시하고 관측일
  fallback 비교를 하지 않는다(3-A). 7일 추세는 결측 수를 함께 표시하고 보간하지 않는다.
- DB를 열 수 없어도 수집·레터는 계속되고(메모리 이력) 저장·비교만 빠진다. 저장 복구는
  재실행으로 이어진다.

## 외부 전달(코테츠 인계 제안)

- 중복 억제 키 제안: `(KST 발행일, 레터 내용 해시)`. 전달 성공 확인·중복 억제·재시도는
  외부 담당이 맡으며 이 저장소는 명령·stdout·종료 코드·인계 문서만 제공한다(6-A).
- 전달 실패 판정은 위 키와 종료 코드(0이면 레터 발행 성공)로 하고, 레터 원문은 외부가
  보관한다. 이 저장소는 전달 이력을 저장하지 않는다.
- 스케줄 등록·알림 대상 설정은 외부 결정이며 이 문서는 승인 기록이 아니다.

## 현황 및 후속 연계

- **8-A 실측 완료 및 소스 상태**: 4개 소스 코드 지원 및 부분 실패 표시는 정상 동작하며,
  사용자 결정에 따라 0.5.0 검증은 단일 호출 2소스(OpenRouter, Cognition 부분성공)로 마감함.
  Arena/AA 다중 페이지 수집은 후속 이슈([#92](https://github.com/qus0in/yoroi/issues/92), [#93](https://github.com/qus0in/yoroi/issues/93))로 분리함.
- 미커밋 변경 및 PR 머지, 코테츠 인계 전달이 남아있어 [#70](https://github.com/qus0in/yoroi/issues/70)은 open 유지.
- [#89](https://github.com/qus0in/yoroi/issues/89) 실환경 detect 스모크는 별도 승인 대기.
