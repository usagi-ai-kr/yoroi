# 하네스 PR #172 기록 통합 (w2, `yoroi-pr172-records-w2`, 2026-10-16)

- 입력 3건 통합: `harness-pr-ci-record.md`·`harness-merge-main-ci-record.md`·`harness-final-audit.md`. 원본은 삭제하지 않음(삭제 후보는 보고서).
- 사실 대조: `gh pr view 172` + `git log origin/main -1`.

## 검증된 사실 (원격 실측, 2026-10-16)

- PR: #172 `https://github.com/qus0in/yoroi/pull/172` — 제목 `fix: 완료 감지 하네스 개선과 1.0.3 발행 기록`, dev→main, head **`f046ece`**, 생성 06:58:01Z.
- CI: pull_request run `38864250138` + push run `38863978398` head `f046ece` **success** (2/2).
- 머지: **MERGED 07:00:39Z**, merge SHA **`fe0c009a39656e5694a4eff01409402e420ec62e`** = `origin/main`(dispatch 기준과 일치), mergedBy `qus0in`.
- dev: `f72a404`(main 대비 1커밋 앞섬) — dispatch 기준과 일치. tag `v1.0.3` = `ea381c6` 불변.

## 원본과 사실이 다른 항목 (시점 차이)

- `harness-merge-main-ci-record.md`: "PR 대기 중·merge 미실행" → **과거 시점 기준**. 실제 PR 생성(06:58)·머지(07:00) 완료.
- `harness-final-audit.md`: "PR 미생성 = w2 미완료·handoff 부재" → 사실 아님: PR #172 생성 확인, 핸드오프 `/tmp/yoroi-harness-pr-handoff.json` 존재. "main CI 38861070165 success"는 head `ea381c6` 기준이며, `fe0c009` 머지后的 main run은 `gh run list --branch main`에 미관측(06:59시각 기준·w3/o 몫).
- `harness-pr-ci-record.md`(w2): "머지·mainCI 없음"은 w2 작업 시점의 사실 → 이후 타 세션 머지로 갱신 필요(본 문서가 통합본).

## 잔여

- 미커밋: AGENTS·스킬 2종(오케 인수 회수/커밋 경량화·메신저 경유 완화 규칙)·dirty5 — 커밋은 o가 통합, 본 작업은 비수정.
- 본 문서 외 원본 3건·소스·README 미변경, Git/외부 쓰기 0.
