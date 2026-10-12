import { INSIGHT_SOURCES } from './sources.js';

type AttributedSource = (typeof INSIGHT_SOURCES)[number];

/** 레터 출처 한 줄. 레지스트리 note가 내부 전용이면 그 조건을 출처에 함께 남긴다(Cognition 약관). */
export function sourceAttribution(source: AttributedSource): string {
  const internalOnly = /internal use only/i.test(source.note ?? '');
  return `출처: ${source.displayName} (${source.license ?? '라이선스 미상'}${internalOnly ? ' · 내부 전용' : ''})`;
}

export const SOURCE_ATTRIBUTIONS: readonly string[] = INSIGHT_SOURCES.map(sourceAttribution);
