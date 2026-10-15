import type { PlanCatalogEntry } from './plan-catalog.js';

const XAI_NEWS = 'https://x.ai/news/grok-build-0-1';
const CHECKED_ON = '2026-10-15';

/** SuperGrok 구독: 사용자 확인(2026-10-15) 기반 추가. 공식 문서상 포함 여부는 미확인. */
export const SUPERGROK_PLAN: PlanCatalogEntry = {
  planId: 'supergrok',
  planName: 'SuperGrok',
  models: [
    {
      modelId: 'grok-build-0-1',
      displayName: 'Grok Build 0.1',
      sourceUrl: XAI_NEWS,
      checkedOn: CHECKED_ON,
      verified: true,
    },
  ],
};
