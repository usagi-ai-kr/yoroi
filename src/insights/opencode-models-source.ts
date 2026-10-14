/** OpenCode 무료 모델 목록 소스 선택(p42). V1은 `opencode models` CLI(기본), V2는 실측 전까지 stub.
 *  근거: https://opencode.ai/v2/docs (설계 scratch/reports/yoroi-p37-design.md §3). npm 배포 상태로 판단하지 않는다. */
export type OpenCodeTarget = 'v1' | 'v2';

/** V2 문서에 없는([미문서]) 항목을 한 곳에 모은다. 실측(V2 설치 후) 전까지 V2 경로는 이 값들에 기대지 않는다. */
export const OPENCODE_V2_UNDOCUMENTED = Object.freeze({
  /** /v2/docs/cli·/v2/docs/providers에 CLI `models` 언급 없음(TUI `/models`만). 삭제 여부는 미확인. */
  cliModels: 'opencode models',
  /** /v2/docs/console/go에 있는 Go 모델 메타데이터 엔드포인트. 가격(무료 판정) 필드는 미문서. */
  goModelsEndpoint: 'https://opencode.ai/inference/go/v1/models',
  /** 플러그인 ctx.model.list(/v2/docs/build/plugins)는 있으나 반환 필드(cost)는 미문서. */
  pluginModelList: 'ctx.model.list',
  /** V2 문서에 Zen 페이지가 없다(/v2/docs/console/zen 404). Zen Free 목록 출처는 사용자 확인 필요. */
  zenFreeList: 'unknown',
});

export const OPENCODE_V2_UNVERIFIED_DIAGNOSTIC = 'opencode v2 models source unverified';
