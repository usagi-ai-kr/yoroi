# 토큰 절약 digest (p64 w3)

목표: 오케스트레이터가 전체 보고·화면 출력을 읽지 않고 압축 digest로 진척을 파악한다.

## 사용법
- `python3 .agents/skills/agent-coordination/scripts/coord_digest.py [label...] [--roster ...] [--reports ...] [--packets ...] [--herdr ...] [--json]`
- 라벨 없이 실행하면 로스터의 모든 라벨을 digest한다.
- 보고 경로 수와 라벨 수가 같으면 라벨별로 연결한다.

## 보장
- `agent read`를 호출하지 않는다(screen read 0).
- herdr 호출 수(`calls=N`)와 `screen_reads=0`를 출력한다.
- 보고서는 `task_id`, 변경 파일 수, 검증 결과 수만 압축한다.
- coord.py·coord_herdr.py·test_coord.py는 수정하지 않는다.
- 주 보고(`yoroi-worker-cognition-openrouter.md`)는 수정하지 않는다.

## 검증
- `python3 .agents/skills/agent-coordination/scripts/test_coord_digest.py`
- `python3 scripts/validate-repo.py`