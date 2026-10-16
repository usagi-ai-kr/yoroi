# compact 최종 수정 기록 (w3, yoroi-compact-final-fix-w3)

- 범위: 마지막 compact 문구 수정. 소유권: footer는 w4에서 w3으로 이전했다(w4 완료 보고 `/private/tmp/yoroi-normal-render-budget-w4-report.json` 기준). 최종 독립 검토는 w4 다음 단계다.
- 기준: HEAD `ef94e90`, origin/dev 일치. 이번 수정은 ROOT 워킹트리 바이트에만 있으며 미커밋이다. 후속 source 커밋이 필요하다.

## 1. 변경
| 항목 | 변경 | 이유 |
|---|---|---|
| 가중치 줄 | 하드코딩 `70/5/10/15%` 제거. `weightShares`·`compactDimensionNames`가 config에서 생성 | 단일 원본(config) |
| 출처 줄 | `- 출처: 성능·속도 오케 AA·Cog/워커 AA, 사용량 OR·OCD` 복구 | 삭제된 필수 출처 정보 |
| 가성비 줄 | compact 배열에서 제거 | 범례의 가성비 줄과 같은 정보(중복) |
| P1 줄 | `워커 intel≥33,` 제거 | 범례의 intel 기준 줄과 중복 |
| 범례 사용량 | `오케 5%` → `weightPct('orchestrator','usage')` 생성 | 하드코딩 숫자 제거(출력 동일) |
| docstring | "정보 동일" 삭제, 실제 역할 설명으로 교체 | 사실과 불일치 |
| 테스트 | 문구 단언 갱신, config 대조 단언, 출처 단언 추가 | 생성 값 검증 |

- 유지: 스코어 공식 줄, 워커 가격 cpt·total 줄과 가산 캡, off-peak 줄, 범례의 50 정규 문장과 ▽ 규칙, 20행, 예산 3600·3800, Free 3500 fallback.

## 2. 예산 (canonical fixed input)
- 수정 전 3,597자(w4 보고와 재현 일치) → 수정 후 **3,562자**. 3,600 이하이고 3,800 이하다.
- 두 role 섹션 포함, NaN·Infinity 없음. Free 섹션은 기존 `>3500` fallback으로 생략되며 이 정책은 바뀌지 않았다.
- 행 20개 유지. 예산 숫자, Free 정책, row 내용은 바꾸지 않았다.

## 3. 검증
- 테스트 26/26 통과: renderer 3개 파일 15개 + markdown·legend 2개 파일 11개. 실패 0.
- `tsc --noEmit` exit 0, error 0건.
- `validate-repo.py` PASS: 679 files, 7 skills, 위반 0건.
- `git diff --check`(HEAD 기준) clean. 수정 파일에 공백 오류 없음.
- 줄 수: formatter 72, legend 59, render 100(미수정), test 97.
- verifier는 `/tmp/yoroi-*` 쓰기를 프로세스 안에서 막고 실행했다. 파일은 쓰지 않았다.

## 4. 해시 (sha256 앞 12자)
| 파일 | HEAD ef94e90 | 수정 후 |
|---|---|---|
| src/insights/letter-markdown-format.ts | cb1e9b2e470c | 7186003fda28 |
| src/insights/letter-top10-legend.ts | 950fb0eff3c5 | e35a83c32e75 |
| tests/insights-top10-render.test.ts | 120245448ee6 | 5de5d03d676b |

## 5. Git·후속
- 워킹트리만 수정했다. git index와 원격은 건드리지 않았다. HEAD와 origin/dev는 모두 `ef94e90`이다.
- 후속 source 커밋이 필요하다. 대상은 위 3개 파일과 이 문서다. 로컬 commit과 push는 이 작업에서 실행하지 않았다.
- 최종 독립 검토는 w4 다음 단계다.

## 6. 남은 것
- 가중치와 범례 사용량 숫자는 모두 config에서 생성된다.
- 출처 줄은 텍스트 상수로 복구했다. 범례의 속도·사용량 출처는 원래부터 config 생성이다.
