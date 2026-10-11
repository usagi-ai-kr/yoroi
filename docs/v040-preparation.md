# 0.4.0 분리 준비 (2026-10-11)

- 기준: `dev=b4f832c`, 인계받은 미커밋 변경 105개. 커밋·push·PR은 승인 대기다.
- 목표: [#89](https://github.com/qus0in/yoroi/issues/89)의 내장 600초 감지기를 분리한다.
- [#70](https://github.com/qus0in/yoroi/issues/70)의 0.5.0 인사이트 작업은 보존한다.
- 기존 감지 루프와 전역 0.3.1 설치는 변경하지 않는다.

## 분담과 감사

| pane | 현재 모델 | 패킷과 결과 |
| --- | --- | --- |
| w12:p1 | Codex GPT-6.1-Sol medium | root: 분담·감사·통합·승인 준비 |
| w12:pG | Gemini 3.8 Flash medium | 변경 분류, 독립 검토와 대조 |
| w12:p5 | DeepSeek V4.1 Flash Ollama Cloud max | 독립 검토·0.4.0 격리 검증 |
| w12:pJ | Step 5 Preview Free OpenCode Go high | TS7022 재현 확인 |
| w12:pK | LongCat 2.5 Preview Free OpenCode Go high | 잠금 경합·macOS 지적 확인 |

- 새 세션·모델 변경 없이 기존 패널에 배정했다.
- pK가 내부 Explore 작업 1회를 생성했다. 추가 위임 금지를 전달했다.
- agy가 비소유 `migrations.ts`를 임시 checkout/apply하여 전체 검증이 타입 오류로 중단됐다.
  현재 원래 V4/V5 diff로 복원됐으며, 이후 원본 저장소에서 패치 실험을 금지했다.
- agy의 최초 자기신고는 침범을 누락했다. 정정 보고와 실제 diff를 함께 감사했다.
- agy의 목록 요약 59/46은 오기였다. 독립 감사에서 실제 배열 60/45를 확인했다.

## 분리 범위

- 기존 변경 중 60개가 0.4.0, 45개가 0.5.0이다. 이 기록은 별도 신규 문서다.
- `src/domain/errors.ts`와 `retry-after.ts`는 detect가 먼저 필요하므로 0.4.0에 포함한다.
- `migrations.ts`는 V4와 `DETECT_MIGRATIONS`만 포함하고 인사이트 V5 재수출은 보류한다.
- `docs/roadmap.md`의 신규 인사이트 실행계약 링크도 0.5.0 hunk로 보류한다.
- HEAD archive에 포함 파일만 복사해 검증한다. 제외 tracked 파일은 HEAD 내용을 유지한다.
- 임시 목록·패치·보고서는 `/tmp/yoroi-v040-*`에 보관한다. 원본 index는 변경하지 않는다.

## 검증 근거와 남은 조건

- p5의 0.4.0 독립 스냅샷: `pnpm run check` 통과.
  타입 검사·475개 테스트·BDD 29개 시나리오/293개 단계·빌드가 통과했다.
- 독립 스냅샷 `python3 scripts/validate-repo.py`: 346 files, 6 skills 통과.
- pJ: 프로젝트 타입 검사와 `insights-render.test.ts` 7개 테스트 통과, TS7022 재현 안 됨.
  근거 없는 타입 수정과 전역 설치는 실행하지 않았다.
- pK: 잠금 경합 테스트 3회 263~279ms로 통과, 다른 잠금 관련 테스트 15개도 통과했다.
  과거 환경의 600ms 시간 단언 실패는 현재 환경에서 재현되지 않았다.
- macOS 지적은 현재 코드에서 재현 안 됨: 이미 `ps etime`을 사용하며 관련 테스트 9개가 통과했다.
- [#89](https://github.com/qus0in/yoroi/issues/89)는 실환경 `detect --once` 스모크를
  별도 승인 조건으로 명시한다. 합성 검증만으로 close하지 않는다.
- [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88)의
  해제·플러그인 로드 관측은 남아 있다. 이번 준비 작업으로 종료하지 않는다.

## 회고

- 파일 개수나 worker 자기신고만으로 보존을 판단하지 않는다. 원본 diff·독립 목록을 대조한다.
- 혼합 버전 검증은 원본을 checkout하지 않고 HEAD archive와 선택 파일 복사로 수행한다.
- 미래 문서를 제외할 때는 해당 문서로 향하는 링크 hunk도 함께 분리한다.
