# 레터 밴 목록 기능 이슈 기록 (w1, 2026-10-16)

- 소유: 본 문서·`/tmp/yoroi-letter-ban-issue-body.md`·보고JSON. 1.0.2 source/config/기존 doc·git 변경 없음. 레터 발행 없음. memo 이슈 읽기만(수정 금지).

## 조치: 신규 feature 이슈 생성

- **Issue [#163](https://github.com/qus0in/yoroi/issues/163)** — title `feat: 설정 기반 레터 밴 목록(공통·오케·워커)`, label `feature`(레포 실제 라벨 확인 후 사용).
- `gh issue create --title … --body-file /tmp/yoroi-letter-ban-issue-body.md --label feature`.
- 본문: 사용자 원문(하드코딩 없이 레터 밴 목록, 공통·오케/워커 각각) + 요구(단일 설정 원본·공통/역할 개별 목록·합집합 제외·model ID 정규화/alias 일관·Top10 후보/보충 재진입 방지·빈 목록=현재 동작·역할 간 격리·합성 회귀 검증).

## 중복 검사 근거

- open 이슈 전체 조회(`gh issue list --state open`): **#162** `[letter] 2026-10-16 레터`(일간 레터·기능 아님), **#141** `[plan] 1.1 후보 성능 소스 — Nous·Vals·Arena`(성능 소스 plan·밴 목록 아님).
- 밴 목록 동일 기능 open 이슈 **없음** → 갱신 대상 없음, 신규 생성. #141은 범위 달라 손대지 않음.

## 후속 범위(이슈에 기록, 임의 확정 금지)

- 레터에서 설정/제외 결과 확인 방법 = **설계 시 검토**. 구체 표시 UI·실제 밴 모델·설정 파일 형식 미확정.
- **Grok 밴 임의 등록 없음**. 신규 milestone 생성/할당·버전 확정 없음.

## #163 갱신 (2026-10-16, 사용자 추가 조건 — `gh issue edit --body-file`)

- **밴 적용 범위 정정**: 밴 대상도 **점수 계산·역할별 전체 적격 후보 점수 분포(모집단)에는 포함**, source 관측/점수/분포/이력 **삭제 아님**. 공통 ∪ 역할 밴은 **Top10 선발 시에만** 적용하고 **보충 재진입 방지**. 직전 본문 "Top10 후보 풀 제외" 뉘앙스를 이로 명확 정정.
- **회귀 수용 조건 추가**: 밴 on/off 시 (1) 모든 모델 점수·분포 기준 불변 (2) Top10만 변화 (3) 반대 역할 격리.
- 수정 근거: 사용자 추가 지시 원문을 본문 "밴 적용 범위 정정" 절에 그대로 포함.

## 분포 모집단 독립 계약

- [role-score-population-contract.md](role-score-population-contract.md)에 w1 독립 계약 정리(모집단=역할별 전체 후보, 모델당 대표 effort 1점·밴 포함, 랭크/보충/▽/가격결측/기여표·n0/n1/상수/동점/결측 수용조건·회귀 3조건). w2 분포 수치 조사와 구분·수치 미단정.
