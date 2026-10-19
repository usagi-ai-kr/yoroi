# 1.2.0 이전 상세 발행 기록 (1.0.3–1.1.1)

- 1.0.0~1.0.2 초기 안정화 발행 기록과 0.x 기록은 [release-history-pre100.md](release-history-pre100.md)·[release-history-pre040.md](release-history-pre040.md) 참조.

## 1.1.1 발행 완료 (2026-10-16, PR #177 → main `29c968fe8ea05037563f77690786a69b21c1f890` = tag `v1.1.1`, milestone 26, [#176](https://github.com/qus0in/yoroi/issues/176))

- 범위(patch): 전역 CLI가 레터 모델 목록 설정을 읽도록 `YOROI_LETTER_MODEL_LISTS` → `${XDG_CONFIG_HOME:-~/.config}/yoroi/letter-model-lists.json` → 레포 config → 기본값 순으로 해석. 파싱 실패는 stderr 경고 1줄. 밴은 오케·워커별(`ban.common` 하위호환), 버전 허용 `allowOlder`는 공통(사용자 확정).
- [검증] unit 1080/1080·typecheck·validate PASS, 경로 테스트 6건(w1), 구현 리뷰 o(문서 예시 정정 1건).
- [완료] main CI [38873193798](https://github.com/qus0in/yoroi/actions/runs/38873193798) success · [Release v1.1.1](https://github.com/qus0in/yoroi/releases/tag/v1.1.1) · 전역 CLI 1.1.1(`--check` exit 0) · #176 close · milestone 26 close. 레터 재발행 없음(기본값 동작 불변).
- [스모크] 전역 CLI에 오케 밴 `claude-opus-5-5` 지정 시 오케 Top10에서만 빠지고 선두 `gpt-6-1-sol`, 워커 선두 불변. 잘못된 파일은 경고 1줄.

## 1.1.0 발행 완료 (2026-10-16, PR #174 → main `431bc7ce1245753b27280b1eaf88a1bac9e2b281` = tag `v1.1.0`)

- 범위(minor): [#163](https://github.com/qus0in/yoroi/issues/163) 밴 목록 + 하위버전 화이트리스트를 `config/letter-model-lists.json`으로 옮김(`allowOlder`·`excludePatterns`·`ban`). 명세: [letter-model-lists-1.1.md](letter-model-lists-1.1.md).
- [검증] unit 1074/1074·typecheck·validate PASS, w1 리뷰 차단 0([리뷰](letter-model-lists-review-w1.md)), 기본 config 렌더 = 1.0.3 렌더 바이트 동일.
- [비차단] 교차 family에서 목록 모델이 successor 쪽일 때 predecessor 보호(현 데이터 영향 0) — 1.1.x 후속.
- [완료] main CI [38870609040](https://github.com/qus0in/yoroi/actions/runs/38870609040) success · [Release v1.1.0](https://github.com/qus0in/yoroi/releases/tag/v1.1.0) · 전역 CLI 1.1.0(`--check` exit 0) · 레터 [#175](https://github.com/qus0in/yoroi/issues/175)(2026-10-16 17:01 KST) 발행 후 #171 close · #163 close(PR Closes) · milestone 25 close.
- [참고] 전역 설치본은 `files`=dist라 `config/letter-model-lists.json`이 없고 기본값으로 동작한다(held-plans와 같은 fallback).

## 1.0.3 발행 완료 (2026-10-16, PR #170 머지 → main `ea381c61b794390c43ac85cc2b515f0022c1af2a` = tag `v1.0.3`)

- 범위(patch): 워커 effort 표기·AA 측정 소스 정합 1줄 + 신규 3케이스 + 버전 1.0.3 + 문서 8. max cap 없음.
- [완료] dev 커밋 `aba39d9` → PR #170 머지 → main CI success(run `38861070165`) · tag `v1.0.3` · [Release](https://github.com/qus0in/yoroi/releases/tag/v1.0.3)(publishedAt 2026-10-16T06:31:13Z, 동일 SHA, Latest) · 전역 CLI 1.0.3(`--check` exit 0, clean archive) · 레터 [#171](https://github.com/qus0in/yoroi/issues/171) 발행(DeepSeek worker `max` 59.3·Argon 6위) 후 #162·#165 close.
- [종료] #164·#167(PR #169 Closes) · #165(레터 후 직접) · #162(후속 레터 후). #163·#168·#141·#29 open 유지.
- [보존] 워킹트리 원본 dirty 유지(main 반영분과 별개): score 1.1 hunk 전체·four-source·orchestration·takeover·worker-effort-source 테스트.
- [검증] 하네스 latest: full unit 1068·8 skills, 상시 skill 자동 적용, exit 4/5/6·300초. 제품 1.0.3·레터 #171 완료와 정합.
