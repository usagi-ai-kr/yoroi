/** #168 모델 자동감지 순수 계약(단위2). 스키마·수집·저장소·catalog/레터 연결은 이 파일 밖이다.
 *  이 모듈은 판단하지 않는다 — 입력으로 주어진 사실만 보존·비교한다. */

/** 감지된 모델 1건. 1 id = 1 model — 유사 이름 자동 병합 없음. */
export interface DiscoveredModel {
  readonly modelId: string;
  readonly displayName: string;
  /** 공식 출처 URL. 모양 검증 대상일 뿐 공식성 증거는 아니다(공식성은 verified 별도 사실). */
  readonly sourceUrl: string;
  /** 확인일(YYYY-MM-DD). */
  readonly checkedOn: string;
  /** 입력으로 전달된 공식 검증 사실. 이 코드는 true를 부여하지도 승격하지도 않는다. */
  readonly verified: boolean;
  /** 접근 티어(플랜 id). 비면 후보 편입 불가. */
  readonly planIds: readonly string[];
  readonly free?: boolean;
  /** 공식 확인된 지원 effort. 비면 후보 편입 불가. */
  readonly efforts?: readonly string[];
}

/** 기준 대비 차이. removed는 '이번 수집 부재' 표기이며 즉시 삭제하지 않는다. */
export interface ModelDiscoveryDiff {
  readonly providerId: string;
  readonly observedAt: string;
  readonly added: readonly DiscoveredModel[];
  readonly removed: readonly string[];
  readonly changed: readonly { readonly modelId: string; readonly fields: readonly string[] }[];
}

/** provider별 세대 스냅샷. */
export interface ModelRegistrySnapshot {
  readonly generation: number;
  readonly observedAt: string;
  readonly providerId: string;
  readonly models: readonly DiscoveredModel[];
}

/** 스냅샷 저장소 계약(1세대 보존). 구현체는 단위2 범위 밖(미구현). */
export interface ModelRegistrySnapshotStore {
  read(providerId: string): Promise<ModelRegistrySnapshot | undefined>;
  write(snapshot: ModelRegistrySnapshot): Promise<void>;
}

/** stdout 1줄 알림 요약. */
export interface DiscoveryDiffSummary {
  readonly observedAt: string;
  readonly providers: number;
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
}

/** discovery 전용 정규화: 소문자·공백→하이픈만 적용한다.
 *  날짜형 suffix·벤더 prefix·셀프 모델 등급 순서는 제거하지 않는다 — 서로 다른 모델이 한 id로
 *  접히는 병합을 막기 위한 의도적 제한이다. 레터 정규화(normalizeModelName)와는 의도가 다르다. */
export function normalizeDiscoveryModelId(id: string): string {
  return id.trim().toLowerCase().replace(/\s+/g, '-');
}
