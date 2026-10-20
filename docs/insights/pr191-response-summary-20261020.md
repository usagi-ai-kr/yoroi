# PR #191 리뷰 대응 종합 요약 (2026-10-20)

- 담당: w18:p3 (소유: 본 문서, tasks.md, pr191-review-response.md, delegation-harness-final-review.md).
- 목적: PR #191 리뷰 지적 3건, MiniMax M3.1 Flash 카탈로그, 퍼블리셔 복구, 하네스 정합 종합 보고.
- 원칙: 제품 코드 추가 수정 금지, PR draft 및 #180 open(머지 보류) 유지, 전 파일 100줄 이하.

## 1. 지적 3건 대응 및 독립 리뷰 결과

| 지적 | 수정 파일 | 음성 반례 및 집중 테스트 | 독립 리뷰 | 미검증 한계 |
| --- | --- | --- | --- | --- |
| **HIGH (env 경계)** | `calibration-env.ts`, `process-port.ts`, `process-runner.ts` | spawn 경계 합성 API키·NODE_OPTIONS·HOME 누락(4/4 통과) | 수용 (w18:p3) | OS 커널/네트워크 격리 아님, 모델 인증 미지원·미검증 정직 표기 |
| **MEDIUM (checker)** | `calibration-checker.ts`, `fixtures.ts`, `verifier.ts`, `task-set.ts` | 무수정 diff 0, 오답 코드, 변조, 타입오류, exit 밀수 차단 | 수용 (w1) | regex 정적 패턴 우회 한계(토큰 증거로 방어), OS 컨테이너 아님 |
| **MEDIUM (3runs 저장)** | `calibration-record.ts`, `codec.ts`, `store.ts`, `sqlite.ts`, `cli.ts` | 위조 capable 거부, evaluation 변조 무시, 파손 행 복구(23/23 통과) | 수용 (w1) | 구버전 표본 상세 없음, DB 파일 직접 조작은 위협모델 밖 |

## 2. 추가 반영 및 현황

1. **MiniMax M3.1 Flash Free 카탈로그**:
   - 공식 근거(블로그 2026-10-19, OpenCode 콘솔 2026-10-20) 바탕으로 `opencode-go-plus`에 한정 무료(`verified: true`, `free: true`) 등록.
   - 명시 alias `minimax-m3-1-flash-free` → `minimax-m3-1-flash` 매칭, Space Bunny 별개 ID 유지. 독립 리뷰 통과(`minimax31-acceptance-review.md`).
2. **퍼블리셔 정규화 및 보완**:
   - canonical repo(`usagi-ai-kr/yoroi`) 파싱 지원, 당일 letter 부분발행 시 누락 댓글만 순환 복원 게시 구현.
   - w1 후속 보완(`yoroi-publisher-review-fix`): F1 repo 게이트, F2 body 정확 일치 게이트 및 누락 판정 보완. w3 최종 독립 리뷰 **PASS**(`publisher-recovery-acceptance-review.md`)·publish 집중 18/18·전체 1197 PASS.
3. **10/20 레터 #192 복구 완료**:
   - 원격 댓글 3건 게시 확인: [c0 Top15](https://github.com/usagi-ai-kr/yoroi/issues/192#issuecomment-6280879673), [c1 Top15](https://github.com/usagi-ai-kr/yoroi/issues/192#issuecomment-6280881730), [c2 Free 보완본](https://github.com/usagi-ai-kr/yoroi/issues/192#issuecomment-6280882849).
   - c0/c1은 본문 일치 증명 산출물 원본, c2는 출처 근거 및 보완 표식을 포함하여 게시 완료.
4. **하네스 위탁 우선 커밋 완료**:
   - 사용자 지시에 따라 `AGENTS.md` 서브에이전트 허용 문구 삭제 및 위탁 우선 확립. 독립 리뷰 통과 후 `dev`에 커밋 `f4d868d` 완료 (9개 파일).

## 3. 검증 및 보류 상태

- 전체 check 1192 통과 시점 확인 후, publisher 보완분 포함 전체 단위 **1197/1197 PASS**(typecheck·BDD 45/635·build clean).
- validate-repo.py 전원 PASS (859 files, 8 skills). git diff --check clean.
- 제품 코드 커밋: `6235833` env·store / `b5ad4c7` publisher / `e33a019` catalog / `a49628e` 문서.
- 보고서 본문 `/tmp/yoroi-pr191-response-bodies.json` 갱신 완료.
- PR Draft 유지, #180 Open 유지, #168/#190 런타임 미구현 유지. 잔여는 외부 CI 확인·외부 재리뷰뿐.
