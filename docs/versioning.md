# 버전 관리와 릴리스 순서

- 버전 원본은 `package.json` 하나다. CLI `--version`도 이 값을 읽는다.
  별도 버전 파일을 만들지 않는다. 스크립트: `scripts/version.py`, 테스트: `scripts/test_version.py`.
- 일반 규칙은 [semver-milestones 스킬](../.agents/skills/semver-milestones/SKILL.md)을 따른다.

## SemVer 정책

- 형식은 엄격 `X.Y.Z`만 허용한다. 선행 0(`01.2.3`), 잘못된 문자, prerelease(`-beta.1`)와
  build(`+sha`)는 거절한다. 지원 방침을 바꾸려면 이 문서와 `version.py` 정규식을 함께 고친다.
- 호환 파괴는 major, 호환 기능 추가는 minor, 수정은 patch다.
- minor 증가 시 patch=0, major 증가 시 minor·patch=0으로 초기화한다. minor는 정수이며
  `0.9.0` 다음은 `0.10.0`이다.
- `0.x`는 초기 개발 단계였다. 1.0.0부터 호환 파괴는 major, 호환 추가는 minor, 수정은 patch다.
  1.0.0은 공개 계약 안정 선언이다. 계약 목록은 릴리스 노트에 명시하고, 변경 영향과 마이그레이션은 milestone·PR에 기록한다.

## version.py 사용법

```bash
python3 scripts/version.py                     # 현재 버전·manifest·예정 vTag·milestone 표시(읽기 전용)
python3 scripts/version.py --bump patch        # dry-run: 파일 변경 없음
python3 scripts/version.py --bump minor        # 0.9.3 -> 0.10.0
python3 scripts/version.py --bump major        # 0.9.3 -> 1.0.0
python3 scripts/version.py --bump patch --apply  # manifest version 필드만 기록
```

- 기본과 `--bump`는 read-only다. `--apply`를 명시할 때만 `package.json`의 version을 쓴다.
- 자동 git commit·push·tag·Release는 하지 않는다.

## 릴리스 순서

1. milestone의 목표·완료 기준·미완료 항목을 확인한다. 열린 채로 남은 항목을 조용히 옮기지 않는다.
2. `--bump` dry-run으로 예정 버전과 `vX.Y.Z` tag를 정하고, `--apply` 후 빌드·출력 버전
   (`yoroi --version`)이 manifest와 같은지 확인한다.
3. dev → main PR에서 CI(`pull_request`)와 전체 검증이 통과한 **검증된 커밋 SHA**를 기록한다.
4. PR을 병합한다(필수 승인 0명이라 자기 PR 승인은 불가하며 `ci` 통과 뒤 병합한다). main에는 push CI 트리거가 없다.
   병합 커밋에서 `workflow_dispatch`로 CI를 실행해 success를 확인한다.
5. 그 병합 커밋 SHA에 `vX.Y.Z` 태그를 만들고 Release로 발행 기록을 남긴다.
   순서는 병합 → workflow_dispatch CI → tag → Release → milestone close다.
6. 발행 후 tag·커밋·산출물·Release가 일치하는지 확인하고 다음 milestone을 정리한다.
   open으로 남긴 이슈는 이관 여부와 닫히는 조건을 기록한다.

- 이미 발행한 tag는 불변이다. 덮어쓰지 않는다. 검증 실패·버전 불일치 시 발행하지 않고
  원인과 남은 작업을 보고한다.
- milestone은 계획, tag는 검증된 커밋, Release는 발행 기록이다.

## 현재 운영 현황 (2026-10-20)

- 버전: `package.json` 1.4.0. [Release v1.4.0](https://github.com/usagi-ai-kr/yoroi/releases/tag/v1.4.0) 발행(main `ff831c6482c618fc503503dd33d63acece519917`, publishedAt 2026-10-20T02:12:27Z).
- tag·Release: `v1.4.0` 발행. 이전 이력은 [release-status.md](release-status.md)에 있다.
- milestone: PR #191 관련 마일스톤은 해당 이슈에서 확인. 발행 순서와 기준은 위 §릴리스 순서를 따른다. 상세 기록은 [release-status.md](release-status.md)와 [roadmap.md](roadmap.md)에 있다.

## 이전 운영 현황 (2026-10-10, 이력)

- 버전: `package.json` `0.3.0`(PR 준비, `0.2.0`에서 `--bump minor --apply`). 커밋·tag·Release는 아직 없다.
  0.3.0은 캐시·이력(`update:global`)과 `watch` 제거를 담은 minor이며, 아직 tag를 쓰지 않았다.
- tag·Release: `v0.1.0`·`v0.1.1`·`v0.1.2` 발행 완료([v0.1.2](https://github.com/qus0in/yoroi/releases/tag/v0.1.2), target `4dfd4d7`).
- milestone: `0.1.2` closed([#29](https://github.com/qus0in/yoroi/issues/29) open·hold 유지),
  `0.2.0`(#5, [#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76)), `0.3.0`(#6, [#71](https://github.com/qus0in/yoroi/issues/71)),
  `0.3.1`(#8, [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88)), `0.4.0`(#10, [#89](https://github.com/qus0in/yoroi/issues/89) 감지),
  `0.5.0`(#7, [#70](https://github.com/qus0in/yoroi/issues/70) 인사이트), `0.6.0`(#9, [#84](https://github.com/qus0in/yoroi/issues/84) trend).
  2026-10-11 재번호: #7은 `0.4.0`→`0.5.0`, 감지 #10은 `0.4.0`, trend #9는 `0.6.0`. #8은 앞선 결정으로 `0.2.1`→`0.3.1`.
- 0.3.0이 PR 준비 단계다(캐시·이력 #71 반영, 0.2.0 범위는 포함). 실제 OpenCode 로드·한도 이벤트·전역 설치는 미실행이며,
  0.3.1([#77](https://github.com/qus0in/yoroi/issues/77))에서 실사용 검증한다. 발행은 사용자 요청 시 위 §릴리스 순서로 진행한다.
