# usagi 정성 역할 적합성 표기 (#194)

## 목적

`usagi-ai-kr/usagi`의 정성 운용 기록(모델별 역할 적합성 기호 + 짧은 메모)을 **레터 3역할 표의 비고 칸**에
출처와 함께 보여준다. 사용자에게 "이 모델이 이 역할에 어울렸는지"라는 정성 신호를 준다.

**이것은 점수·순위가 아니다.** 가중치·tie-break·추천·필터에 절대 쓰지 않으며, 렌더 전용 표기다.
기호를 벤치마크 점수로 승격하지 않는다.

## 출처

- 저장소·경로: `usagi-ai-kr/usagi` · `docs/wiki/Model-Operations.md`
- 커밋: `a43d31a` · 확인일(checkedOn): `2026-10-20`
- URL: <https://github.com/usagi-ai-kr/usagi/blob/a43d31a/docs/wiki/Model-Operations.md>
- 원문은 "단일 날짜, 서로 다른 저장소와 작업, 작은 표본의 정성 기록"이며 통제된 비교·벤치마크가 아니다.

## 데이터

- 설정: `config/model-role-fit.json` (모델 base id → 역할별 `{ fit, note }`)
- 기호: `◎` 관찰상 적합 / `○` 가능하지만 조건부 / `△` 제한적·표본 부족 / `×` 이번 운용에서는 어려움
- 기록 모델(2026-10-20 확인분): `gemini-3-8-flash` · `deepseek-v4-1-flash` · `glm-5-3-flash` · `muse-spark-1-3` ·
  `minimax-m3-1-flash` · `mimo-v2-6-flash` · `claude-sonnet-5-5`
- `Claude 계열(버전 미상)` 행은 특정 모델 id가 아니므로수록하지 않았다(일반화 금지, 원문 명시).

## 사용 규칙

1. `roleFitNote(modelId, role)` 는 `normalizeModelName` 기반 base id 로 모델을 찾고
   `'usagi <기호> · <짧은 메모>'` 를 돌려준다. 모르는 모델·역할·깨진 설정은 `undefined`(미표기)다.
2. effort 접미사(`-xhigh` 등)는 제거해 base 로 매칭한다(관찰은 모델 단위).
3. 3역할 표의 **비고 칸**에만 표시한다. 스코어·순위·선택에는 영향이 없다(렌더 전용).
4. 표시 안내에 `usagi = 2026-10-20 정성 운용 관찰(점수 아님)` 과 출처 URL 을 함께 남긴다.
5. 설정 파일이 없거나 깨져 있으면 조용히 미표기한다(레터 발행·다른 출력을 막지 않는다).

## 갱신 방법

`config/model-role-fit.json` 의 `source.commit` 을 갱신하고 기호·메모를 원문에서 옮긴 뒤 `checkedOn` 을 바꾼다.
기호는 원문에 없는 값을 추정해 채우지 않는다(관찰 없는 모델·역할은 넣지 않는다).
