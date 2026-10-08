# 캐시 계층 설계: TTL·메모리·영구 이력 경계 (#35·#36, 설계 초안)

> 준비 단계: 설치·구현 금지. 근거: #30, #31(단일 수집), #39·#40(상태).

## 1. 역할 분리 (3층, 진실 원본은 1곳)

- 영구 이력: SQLite + Drizzle(`better-sqlite3` 13.0.3, 별도 파일). 진실 원본.
- TTL 캐시: `@keyv/sqlite` 6.1.0(+`keyv` 6.1.0). 조회용 임시, 영구 DB와 별도 파일·네임스페이스.
- 메모리: `lru-cache` 11.5.3. 최근 스냅샷·집계 재사용, 프로세스 내만.
- 캐시는 원본 기록이 아님. 캐시 미스·만료가 수집을 유발하지 않음(#35).

## 2. 읽기·쓰기 경로

- 읽기: LRU → Keyv TTL → SQLite fallback. `latest`는 캐시 우선(api-contract §1).
- 쓰기: 수집기(`CollectorService`, #31 §2)만 영구 저장 후 캐시 갱신. 웹·CLI 읽기 전용.
- TTL·LRU 손상·접속 실패 시 저장소 조회로 복구, 오류는 `unavailable` 격리.

## 3. 키 규칙·TTL·용량

- 키: `v1:{provider}:{windowId}:{range}`. 집계는 `v1:agg:{provider}:{range}`.
- range 인코딩: 집계는 기간 필터 그대로(`24h`·`7d`·`30d`, ui-design §2).
- 히스토리는 `from..to~limit`(ISO UTC·분 단위 정규화, 생략분은 `-`, limit 기본 100).
- TTL: 수집 주기(60초, #31 §2) 정합으로 짧게. `stale` 표시는 TTL 만료가 아닌
- 상태 모델(`failure-policy.md`)이 결정. 만료값 노출 금지, fallback 조회.
- LRU: 크기·TTL 상한, 공급자·창·기간별 키. 축출은 조용히 fallback, 소진 예상 금지.

## 4. 무효화·재시작 동작

- 무효화 트리거: 신규 저장·`usage.resetChanged`·오류 전이 시 관련 키만 삭제.
- `auth.expired`는 해당 공급자 키만 무효화, 타 공급자 캐시 유지.
- 재시작: LRU 소실(정상) → TTL 잔존값 사용 → 없으면 DB. TTL 파일 손상 시 재생성.
- 동시 조회: 단일 비행(같은 키 1회 조회 공유), stale 값의 새 데이터 오표시 금지.

## 5. 검증 계획

- TTL 만료·무효화·손상·재시작 fallback을 합성 저장소로 재현.
- LRU 축출·TTL·stale·동시 조회를 가짜 시계·동시성으로 검증(#36).
- 결과는 #35·#36에 합성 테스트 + CLI 회귀 결과로 기록.
