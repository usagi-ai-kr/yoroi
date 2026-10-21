# 인사이트 레터 PM2 발행 (#125)

2026-10-13 사용자 지시로 레터 발행 주체가 Hermes 크론(`yoroi-letter-daily`)에서 **yoroi 자체 PM2**
프로세스(`yoroi-letter`)로 이관됐다. 발행 명령은 codex가 만든 `yoroi insights publish`
(09:00 KST 이전 skip · 당일 중복 skip · 발행 후 전일 레터 close)이며, 이 문서는 그 운영 절차다.

## 전제 조건

- `yoroi`(전역 CLI), `gh`(이슈 발행·close), `opencode`(free 카탈로그 수집)가 **PM2 데몼의 PATH**에 있어야 한다.
- PATH를 설정 파일에 하드코딩하지 않는다: **로그인 셸에서 pm2를 시작**하거나, 이미 떠 있으면
  `pm2 restart yoroi-letter --update-env`로 환경을 갱신한다.
- PM2 데몬의 시간대가 Asia/Seoul이어야 `cron_restart '0 9 * * *'`가 09:00 KST를 뜻한다.
- 자격 증명(`YOROI_AA_API_KEY`·`YOROI_OPENROUTER_API_KEY`·`gh` 인증)은 시작 셸 환경에서 물려준다. 설정 파일에 넣지 않는다.

## 등록

```bash
pm2 start integrations/pm2/yoroi-letter.config.cjs   # 등록·시작
pm2 save                                           # 재부팅 resurrect 목록에 저장
```

PM2는 등록 직후와 `pm2 resurrect` 때 cron 앱도 1회 실행한다. 09:00 이전이면 publish가 조용히
skip하므로 안전하고, 당일 이미 발행됐으면 중복 방지로 다시 skip한다.

## 상태·로그·수동 발행

```bash
pm2 describe yoroi-letter    # status · cron restart 스케줄 확인
pm2 logs yoroi-letter        # stdout=published #N url 시각, stderr=진단
yoroi insights publish       # 수동 발행(가드 통과 시 같은 규칙)
```

- 수동·PM2 발행도 3역할 형식을 쓰려면 `YOROI_LETTER_THREE_ROLE=on`을 설정한다. 없으면 2역할 레거시 본문이 된다(2026-10-21 #268→#269).

## 중지·해제

```bash
pm2 stop yoroi-letter        # 스케줄 정지(등록 유지)
pm2 delete yoroi-letter      # 등록 해제
pm2 save                     # 해제를 저장 목록에 반영
```

## 재부팅 복구

- 1회 설정: `pm2 startup`(launchd 안내대로 실행) → `pm2 save`.
- 재부팅 후 `pm2 resurrect`로 목록이 복원되며, 저장된 cron 일정이 다시 걸린다.
- 복구 확인: `pm2 describe yoroi-letter`에 cron restart가 보이고, 레터 이슈에 당일 게시물이 있는지 확인한다.

## 장애 시 확인 순서

1. `pm2 logs yoroi-letter --lines 50` — stderr 코드와 종료 코드를 본다.
2. 수동 `yoroi insights publish --dry-run`으로 수집·렌더만 재현한다(게시 없음).
3. 전일 레터 이슈가 열려 있으면 close 실패 가능성을 확인한다(`gh` 권한·라벨).
4. 같은 날 두 번 실행돼도 중복 skip이므로 재실행은 안전하다.
