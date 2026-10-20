# #168 Unit 7: 권장 정책 기본값 (탐색 미활성)

본 단위는 권장값만 정의한다. 탐색 켜기·배선·수집·once·레터 연결 없음.
결정 Q1-Q4는 아래 값으로 고정하고, 다른 정책은 만들지 않는다.

## 권장값

- Q1 자동 편입 OFF (`autoEnroll: false`). 러너는 이 값을 읽지 않는다.
- Q2 제거는 diff 표기만 (`deprecation: 'diff-only'`, 유일값).
- Q3 baseDir 기본 `~/.config/yoroi/discovery` (XDG 우선, 명시 override).
- Q4 공개/CLI 제공자만: `opencode`·`openrouter`·`ollama`.
  API 키 제공자는 목록에 없다. enabled일 때 providers 미지정이면 이 목록.

## 계약

- `loadModelDiscoveryConfig`는 비객체에 기본값을 돌려준다.
  `providers`·`sources` 별칭을 모두 받고, 불리언·경로는 엄격 판정한다.
- `resolveDiscoveryBaseDir({env, home, override})`는 env·home 주입으로
  검증한다. `process.env` 직접 읽기 없이 호출자가 넘긴다.
- `providers` 명시로 권장 목록을 좁힐 수 있다. 넓히려면 별도 결정이
  필요하며, 키 제공자는 `verified` 확인 없이는 편입되지 않는다(게이트 규칙).

## 검증

- 집중 10/10 (기존 7 + 권장값·baseDir·excluded 우선 3).
- `pnpm run typecheck` clean. `python3 scripts/validate-repo.py` PASS.
- `git diff --check` clean. 파일 100줄 이하. 커밋·push 없음.
