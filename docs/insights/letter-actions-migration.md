# 레터 발행 GitHub Actions 전환 (issue #194, 2026-10-20)

- 상태: **Unit 1 — 초안만. 라이브 실행 없음.** 이 워크플로는 아직 한 번도 실행되지 않았다(실행 기록·발행 결과 없음).
- 변경: 기본 발행 게이트 09:00 KST → **08:00 KST**(`src/composition/insights-publish.ts`), 도움말 정정, 경계 테스트 추가,
  `.github/workflows/letter-publish.yml` 신규(초안). `--not-before`는 계속 덮어쓰기 가능하다.
- 날짜 계산: 앱이 KST(UTC+9) 기준을 직접 계산한다(`insightPublicationDate`, `kst()`). 러너 로컬 시각에 의존하지 않는다
  (워크플로는 `TZ=Asia/Seoul`을 둬 로그·관측성만 KST로 맞춘다).

## 1. 스케줄·시각 변환

- cron `0 23 * * *` = **UTC 23:00 = 다음 날 08:00 KST**. 앱 게이트 기본값 08:00 KST와 일치한다.
- GitHub 스케줄러는 실행이 지연될 수 있다. 지연 시 그만큼 발행 시각이 밀리고, 08:00 이전으로 넘어가면
  앱 게이트가 `skip: before 08:00 KST`로 종료한다(발행 없음). 다음 날 같은 시각에 다시 시도된다.
- 수동 실행: Actions 탭의 `workflow_dispatch`로 즉시 실행할 수 있다(게이트는 동일하게 적용).

## 2. 필요한 시크릿(값은 저장소에 쓰지 않는다)

| 키 | 용도 | 상태 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 이슈 생성·댓글·close (workflow 권한 `issues: write`) | Actions 기본 제공(별도 등록 불필요) |
| `YOROI_AA_API_KEY` | Artificial Analysis 수집 | **사용자 등록 필요** |
| `YOROI_OPENROUTER_API_KEY` | OpenRouter 수집 | **사용자 등록 필요** |

- 워크플로는 시크릿 **참조만** 한다(`${{ secrets.* }}`). 값·값의 일부도 저장하지 않는다.
- 등록 위치: 저장소 Settings → Secrets and variables → Actions → New repository secret.

## 3. 동시성·중복 방지

- `concurrency: group: letter-publish`, `cancel-in-progress: false` → 겹친 실행은 취소하지 않고 **순차 대기**한다.
- 앱 내부 중복 방지: 당일 제목(`[letter] YYYY-MM-DD AI 인사이트 레터`)이 있으면 본문을 새로 만들지 않고,
  댓글 3개가 완결돼 있으면 `skip: already published #N`, 일부만 있으면 누락 댓글만 복원 게시한다.
- 이전 open 레터는 새 발행 뒤에 순차 close한다(workflow 권한 밖의 쓰기는 하지 않는다).

## 4. 알려진 한계 — 새 러너는 상태가 비영속이다

- 러너는 매번 새 컨테이너다. `~/.local/share/yoroi/yoroi.db`(SQLite: 일별 수집분·이력·교정 상태)와
  letter 저장소 캐시가 **그 실행에서만 존재**한다. 이전 실행의 DB는 남지 않는다.
- 결과: ① 전일 비교선(변동 ▲/➖ 표기)이 없어진다 ② 이전 실행에 저장된 오늘 수집분을 재사용할 수 없다
  ③ 매 실행이 새로 수집한다 ④ SQLite 기반 이력 기반 기능(레터 변동·이전일 close 대상)이 사실상 비어 있다.
- PM2 로컬 발행(현재 `yoroi-letter` 프로세스)과 **양쪽이 동시에 돌아가지 않도록** 전환 순간 PM2를 멈춰야 한다.
  지금 상태에서 둘 다 켜면 당일 제목 중복 검사로 본문 중복은 막히지만, 새 러너가 매번 수집해 자원을 중복 사용한다.
- 이 한계의 해소(캐시·이력 영속화)는 별도 결정이 필요하다. 본 단위에서 결정하지 않는다.

## 5. 수동 시험 절차(라이브 발행 전)

1. 로컬 dry-run: `pnpm run build && node dist/src/main.js insights publish --dry-run`
   → 제목·중복 판정·close 대상만 출력하고 원격 쓰기는 없다.
2. 게이트 경계 확인: `--not-before 07:59`로 실행하면 `skip: before 07:59 KST`로 종료한다(조회·렌더 없음).
3. Actions 수동 실행: `workflow_dispatch` → `GH_TOKEN`과 수집 시크릿이 있어야 수집·발행이 진행된다.
4. 첫 실행 후 확인: 이슈 본문·댓글 3개, `published #N ... KST` 로그, 이전 open 레터 close 여부.

## 6. PM2 중단·롤백 절차(실행하지 않음)

- 전환 절차(사용자 승인 후): `pm2 stop yoroi-letter` → Actions 시크릿 등록 → `workflow_dispatch`로 1회 시험 → 정상 확인 후 cron 대기.
- 롤백: `pm2 start yoroi-letter`로 로컬 발행 복귀. 필요하면 `.github/workflows/letter-publish.yml`을 삭제하고
  기본 게이트를 09:00 KST로 되돌린다(코드 커밋이므로 되돌림 커밋이 필요하다).

## 7. #194 완료를 위해 사용자 조치(미완료 항목)

1. `YOROI_AA_API_KEY`·`YOROI_OPENROUTER_API_KEY` 저장소 시크릿 등록.
2. PM2 `yoroi-letter` 중단 승인(중복 수집 방지) — **이 단위는 실행하지 않음**.
3. 러너 이력 비영속 한계에 대한 정책 결정(매 실행 재수집을 허용할지, 저장소를 붙일지).
4. Actions 최초 라이브 실행과 결과 확인(지연 가능성 감안).
5. 머지·PR 상태: PR #191 draft·#180 open 유지. 본 단위는 커밋·push·태그·시크릿 설정을 하지 않았다.
