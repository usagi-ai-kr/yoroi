# Free 티어 점수 누락·리뷰어 연결 확인 요청

- 사용자: DeepSeek·GLM·MiMo는 점수가 있는데 Free 표에 안 보임. 추가된 리뷰어 역할도 확인.
- 기존 의견 주석 이동과 리뷰어 파레토 조사 범위를 유지하며 후속 진단한다.
- 최신 레터 #225 댓글3과 실제 렌더 경로를 읽기 전용 대조한다.
- 모델별 원본 AA/다른 근거→alias/base/free 접미사→Free catalog→후보/zone/ban/effort→셀 출력 추적.
- 점수 없음(-)·기준 미달(✗)·기준 통과(✓ 점수)를 구분하며, 점수가 숨겨지는 정확한 단계와 근거를 제시.
- freeCell은 passed=false면 점수를 숨김; 이것이 사용자 사례의 원인인지 재현한다.
- FreeRow/freeRowsFrom/Free header가 2역할만 있는지, 리뷰어 후보가 Free에 연결되는지 확인.
- 점수·가중치·threshold·ban·무료 인증 정책은 진단 중 변경하지 않는다. Free 실측 금지.
- 모델별 하드코드나 가짜 점수로 해결하지 않는다.
- 다음 구현 단위는 일반화된 표시/매칭/배선 수정과 의미 있는 회귀 검증으로 제안.
- 소유: docs/insights/free-score-audit-result-20261021.md 및 tmp 보고서만.
- 5분 안에 근거·판정·수정 대상 파일·검증·다음 패킷을 보고.

## root 1회 합성 대조 결과 (실제 카탈로그 함수 사용)

- 공식 `officialFreePlans(officialFreeListing())` 를 그대로 사용.
- AA 레코드 ID: deepseek-v4-1-flash, glm-5-3-flash, mimo-v2-6-flash, minimax-m3-1-flash.
- 합성 intelligence_index=60/61/62/63, speed=100/101/102/103, priceInput=1/priceOutput=2.
- 일반 카탈로그: 각 모델 AA=60/61/62/63 정상.
- 공식 Free 카탈로그: MiniMax AA=63, 나머지 AA=-·indexMissing=true·belowZone=true.
- 실제 Free ID에는 -free가 남고, model-aliases.ts에는 MiniMax의 -free 별칭만 존재.
- 따라서 세 모델의 -free 경로 매칭 누락은 공개 원본 데이터 없이도 확정 재현 가능.
- 사용자 요청은 확인이므로 이 단위에서 기준·점수 정책 또는 파레토 계산은 변경하지 않는다.
