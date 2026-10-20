# Arena 원문 대조와 승인 보완 (2026-10-20)

총괄이 https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset 을 직접 조회했다.
대상은 이슈 #190이 지정한 정확한 데이터셋이다. 첫 리뷰의 다른 lmsys URL은 근거가 아니다.

## 관측 사실

- webdev는 Code Arena, agent는 Agent Arena aggregate이다.
- 문서에 per-signal로 agent_bash_recovery_steps 등이 나열된다.
- agent_bash_reliability 및 _no_prereq 관측 시점 차이:
  - 총괄 초기 카드 대조 시점: 카드 본문 per-signal 목록에 없어 미확인으로 기록.
  - 후속 w3 공식 뷰어 조회 시점: 뷰어 `Subset (24)` 목록에 실재(263/213행) 확인.
  - 다만 코딩 적격 여부 및 행 스키마는 미확인이므로 allowlist 거부는 유효함.
- rating은 Bradley-Terry Arena Score이며 agent score는 IPS 추정치다.
- agent viewer에는 음수 score도 보인다. 0~1 성공률이라는 첫 리뷰 설명은 틀렸다.
- agent aggregate 전체가 코딩 데이터라는 근거는 확보되지 않았다.
- HF 행 스키마에는 subset 열이 없다. transport의 dataset config를 별도로
  전달/주입하는 내부 파서 계약과 원문 행 스키마를 구분해야 한다.

## 수정 기준

1. 확인된 webdev와 agent_bash_recovery_steps만 현재 allowlist에 남긴다.
   일반 agent aggregate와 reliability 계열은 거부하는 회귀검증 추가.
2. 양수 및 음수 IPS는 수치 그대로 보존한다. 성공률로 정규화/클램프하지 않는다.
3. 날짜 qualifier·subset·category는 후속 저장에서 병합하면 안 되는 식별근거다.
   현재 단위는 실제 DB에 연결하지 않는다. 저장 통합 전 복합 식별 검증이 필요하다.
4. 출처 URL·확인일·직접 본 스키마 필드·미확인을 문서화한다.
5. 초기 독립 리뷰는 BLOCK으로 정정되었으며, w1 수정 후 w3의 최종 독립 리뷰
   ([arena-final-review-20261020.md](arena-final-review-20261020.md))를 통해 PASS 완료됨.
6. CI 감사의 procfs 원인은 직접 재현하지 않았다면 추정으로 표기한다.
   로그에서 확인한 timeout/마지막 출력과 원인 확정을 구분한다.

## 최소 하네스 조치

관측: 출처 불일치 및 수치 의미 오설명을 실제 원문조회 없이 PASS 처리했다.
조치: 기존 skill-authoring 검증 절에 외부사실의 실제 조회URL/시점·확인/미확인 구분,
이슈 지정 출처와 일치 여부 확인을 한 항목으로 추가한다. 새 규칙파일·도구 추가는 없다.
이 장애의 진단→최소수정→검증→기록 한 루프만 수행하고 제품 작업으로 복귀한다.
