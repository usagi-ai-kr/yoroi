# 1.0.3 워커 effort 표기 수정과 최종 발행

- 사용자 max 허용 질문에서 실제 워커 라벨-지표 소스 불일치 확인.
- AA DeepSeek Flash Max 지표에 Cognition high 라벨이 붙는 것이 문제.
- high capability cap은 없음. 오케 high/max 최고점 선택은 기존대로 유지.
- 이미 공개된1.0.2 tag adea4d3는 불변. 최소 버그 수정만1.0.3으로 발행.
- 사용자의 commit·release·letter 승인 흐름 유지, 레터는 수정본으로 게시.
- w1: clean main1.0.2 기반 워커effort fallback 최소 수정·회귀·버전1.0.3 후보.
- w3: 독립 리뷰, PR/CI/머지/main CI 및Release 단계별 인계.
- w2: 공개변형 분석 완료 후 수정본레터/전역 갱신 준비로 인계.
- ROOT 기존score dirty의 해당 fallback만 필요시 승인범위로 편입.
- 다른1.1 worker 정책·weights·bonus·effort cap 구현·원본test는 제외·보존.
- 기존 worker-effort-source.test 원본 보존, 신규 좁은 회귀로 검증.
- score 원값·순위 변화 없는지 확인, 측정출처에 effort 표기 일치.
- 실제로 source변화가점수에영향있으면임의진행말고즉시근거보고.
- 버전원본package.json 1.0.3, 기존lock/생성물절차따름.
- 단계: clean검증·독립리뷰 → commitpush → PR CI·머지 → mainCI → Release → global → letter.
- dirty 원본 보존·privateindex·main직접push금지. 새milestone·추가기능없음.
- 완료docs·이슈진척·validate후정확한최종URL/SHA보고.

- 감사 보완: compact 생성요구의 tmp산출물 소유목록 누락을 발견, 원본패킷 보존하고 보완본으로 해당파일만 승인.
