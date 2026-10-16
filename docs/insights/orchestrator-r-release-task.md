# R 선형 가성비 1.0.2 작업

- 사용자 확정: 오케 성능/사용량/속도/가성비 = 0.70/0.05/0.10/0.15 (합1).
- AA I/(P+0.01), 제곱만 제거. log10·소스별 min-max 유지.
- Cog USD/task 역방향·AA/Cog max 유지. 워커 가중치·가산·effort는 변경 금지.
- Grok4.6/4.7 세대 독립 예외 유지. 점수상4.6 이탈 허용. 순위 재계산.
- 앞선 R 시뮬레이션은 I² 기준으로 최종 결과와 구분한다.
- 기존 지시 범위의 커밋·push·PR·머지·Release·전역CLI갱신까지 완결.
- 레터 #160 수정·재발행 없음. 새 마일스톤 없음.
- 기존 dirty5 및 연구 문서 보존. score.ts/four-source-score.md hunk분리 필수.
- w2 구현, w1 독립 검증·리뷰. 단계별 패킷·단일파일 소유권.
- main 최신 실측을 기준으로 dev동기화 계획. main 직접push 금지.
- 모든 작성파일100줄 이하. README/AGENTS 변경 없음.
- 단위·BDD·타입·빌드·레포검증, clean 릴리스 트리와 공개 고정입력 비교.
- main CI후 tag·Release, clean SHA 전역갱신과 .env 비공개 보호·버전내용 확인.
- 원천 대용량 snapshot·개인 사용량·비밀값 커밋/노출 금지.

## 단계
- w1 연결 확인. w2 사전조사 완료·dirty private백업. 독립검증 계약 진행 중.

## 단계별 실측
- w2 core: 타입·직접 회귀12통과. 선형 I/P 및 R 복구. worker dirty보존.
- w2 회귀: 1029 중1023통과. 잔여6=옛참조헬퍼3+compact길이3.
- w1 렌더: 표4차원·범례·5회귀통과. 참조헬퍼는후속소유로분리.
- w2 문서: 정책4종·package1.0.2 준비, validate643통과.
- w1 현재: core독립리뷰·참조헬퍼선형정정.
- w2 현재: renderer독립리뷰·기존compact예산유지문구축약.
- 후속: full clean검증·고정입력순위·최종교차리뷰→commit/dev push/PR/CI/merge/mainCI/release/global.

## 통합 검증과 잔여
- 원본unit1029·BDD45/632·build1.0.2·clean unit1027/BDD45/build 통과.
- compact 예산3600/3800유지·20행불변. 최종독립리뷰PASS.
- w2 비소유helper주석수정auditFAIL은 w1실제diff corrective review로승인·위반기록보존.
- 후보계산은Grok둘이탈을보고했으나baseline #160순위일부불일치발견. 원인/수치 재대조중.
- w2: 동일입력native control재현·선형R확정·cleanmanifest최신화.
- w1: 실제clean후보리뷰·release-status/tasks·PR본문준비. 커밋/원격아직실행전.

## 사용자 추가 범위 (커밋 전 수신)
- R·선형가성비 구현/검증 완료분은 유지. commit/push/발행은 아직실행전.
- 역할별전체적격후보 기준 점수분포중심50 개선을 1.0.2 검증범위에추가.
- 기존temp staging index는 추가보정전이므로 발행에쓰지않고 후속재구성한다.
- w2 분포수치·원인·보정방식비교 조사, w1 모집단/선발계약 독립조사.
- 밴목록 후속기능 #163: 설정공통/오케/워커; 점수·분포에는포함, Top10선발/보충만제외.
- 밴목록 기능 자체는 이슈기록만. 실제밴모델·설정형식·마일스톤 미확정.

## 점수분포 후속 결정·진행
- 추가이슈: #164 사용률90% warn 상태(feature), 구현/마일스톤할당 없음.
- 분포조사control 교정: Free누락해소후 rawTop10이기존R 20행과일치. 오케38/워커19 후보.
- 원점수 분포는오케44.4±25.7/워커55.6±10.9. 단순평균저하보다분포폭차이가크다.
- 사용자가 정규순위변환(중심50/표준편차약10)을선택·확정했다.
- w2 순수수학 normalRankScores, w1 역할별후보통합·표시/원점수구분·▽원정책보존.
- 빈모집단[]/단일·모두동점50/미측정표시불변. finite·동점모집단정규형태는근사.

## 사용자 추가 워커
- user가 w3/w4 추가. coord실측 p19 Claude Haiku5.5 max, p1A GPT-6-Luna max. 세션/모델변경없음.
- dispatch별칭 w3/w4는 /tmp/yoroi-score-roster.md에만추가. 기존타주체orchestration변경보존.
- w3 순수수학모듈독립리뷰, w4 통합파이프라인/모집단·원점수보존독립리뷰.

## 사용자 인계 지시
- w1 현재통합단위는마무리하도록유지. 이후추가배정없이 w4(GPT-6-Luna)로통합소유권인계.
- 세션/모델/패널변경·종료없음. w3(Haiku)는수학독립리뷰계속.
- 회귀스냅샷1041중1015통과/26표시기대값실패. raw계약/compact실패0.
- w2 기존tests정정: raw가중합/가격/bonus기여assert유지,표시기대값만별도정규화계약반영.

## 최종 병렬 검증 (사용자 즉시 분배 지시 반영)
- w1 통합완료/추가배정없음. w4 NaN표시guard·타입·예산완료. sourcefreeze.
- w3 수학비차단승인·주석/독립기대값보완완료. w2회귀1042전체통과.
- w2 clean52목록의이전R테스트/출시docs누락을보완후 전체check·validate.
- w3 guard최소diff/기존rawassert·cleanworkerhunk/coverage 독립검토.
- w4 정본renderer actual20행·전체38/19분포·preview 검증. 의존성대기없이각자보고.

## 최종 발행 단계 분배
- dev 4b30f72: unit1042·BDD45/632·빌드·validate680 PASS, compact3562자.
- w3: PR166 최종 본문·ready·해당 head PR CI 확인. 머지는 다음 단계로 분리.
- w2: w4 수정 전역 갱신 스크립트 독립 리뷰. main CI·Release 확인 후 설치 인계.
- w4: 발행 후 최소 완료 문서·검증 체크 준비. 미실행 완료 주장 금지.
- 사용자 원본 dirty5·1.1 이월·레터 발행 보류 유지.
