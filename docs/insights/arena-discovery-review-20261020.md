# Arena 단위A 및 #168 설계 독립 리뷰 (2026-10-20, w2)

- 대상: w1의 #190 Arena 단위A (5파일), w3의 #168 모델 자동 감지 설계 (1파일).
- 원칙: 코드 수정 없이 독립 대조만 수행. 차단 결함과 비차단 권고를 구분한다.
- 2026-10-20 보완: 총괄의 원문 대조 결과 반영(docs/insights/arena-source-check-20261020.md).

## 1. #190 Arena 단위A 재검토 (결함 정정 및 초기 BLOCK)

1. 출처 URL 오류 정정:
   - 초기 리뷰의 `lmsys/chatbot-arena-leaderboard`는 잘못된 인용임.
   - 실제 지정 공식 출처: `https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset` (확인일: 2026-10-20).
2. 서브셋 및 지표 의미론 결함 정정:
   - `webdev`는 Code Arena (Bradley-Terry Elo rating).
   - `agent`는 Agent Arena aggregate이며, 개별 시그널로 `agent_bash_recovery_steps` 등 존재.
   - `agent_bash_reliability` 및 `_no_prereq`는 카드 본문 per-signal에는 미기재(뷰어 24개 목록엔 존재하나 코딩 적격 미확인).
   - agent score는 0~1 성공률이 아니라 **음수를 포함하는 unnormalized IPS 추정치**임.
     초기 리뷰의 0~1 성공률 단정은 틀렸으며, 정규화/클램프 없이 수치 그대로 보존해야 함.
   - `agent` aggregate 전체가 코딩 데이터라는 근거가 없음(비코딩 과제 혼입).
   - HF 행 스키마에는 `subset` 열이 없고 transport config 수준에서 주입됨.
3. 초기 차단 판정:
   - **BLOCK (수정 완료 전 PASS 금지)**. 구조·합성테스트 통과를 외부 스키마 증거로 쓸 수 없음.
   - 조치 필요: 확인된 `webdev`와 `agent_bash_recovery_steps`만 allowlist 유지,
     일반 `agent` aggregate 및 reliability 계열 거부 회귀검증 추가 후 재판정.

## 2. #168 모델 자동 감지 설계 검토 (w3 산출물)

1. 기존 확정 결정 준수 여부:
   - 자동 감지를 diff 기록 및 stdout 1줄(`detect-render` 스타일)로 한정한 점,
     공식 메타데이터 5조건 충족 시에만 후보 풀 편입, 수집 실패 시 last-good 보존,
     `config/letter-model-lists.json`의 `discovery` 섹션 확장 등 기존 결정과 정확히 일치함.
2. 신규 제안 및 미확인 사항 분리:
   - 폐지 grace(2세대 연속 부재) 및 스냅샷 저장 위치를 사용자 확인 대기로 분리 표기함.
   - Unit 1 범위를 제공자 어댑터 미구현(순수 diff·게이트·타입)으로 제한한 것은 안전함.
3. 공식 API 인증 단정 보완:
   - w3의 "공식 API 전부 인증 필요"는 상용 벤더에 국한되며, 로컬/오픈 엔드포인트는 별도 확인 필요.
4. 판정: **PASS (설계 원칙 준수)**.

## 3. 검증 결과 및 최종 판정 전환

- 본 문서의 BLOCK 판정은 출처 URL 오류 및 0~1 성공률 왜곡을 바로잡기 전의 중간 감사 결과임.
- **최종 리뷰 완료**: w1의 스키마 수정(음수 IPS 보존, allowlist 제한, 복합식별키) 반영 후,
  w3의 최종 독립 리뷰([arena-final-review-20261020.md](arena-final-review-20261020.md),
  `/tmp/yoroi-20261020-arena-final-review-report.json`)를 통해 **PASS (차단 없음)** 판정으로 통과 완료됨.
- `python3 scripts/validate-repo.py`: PASS. `git diff --check`: clean. 파일 ≤ 100줄 규칙 준수.
