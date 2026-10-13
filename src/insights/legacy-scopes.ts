import type { InsightDailyKey, InsightHistoryPort, InsightSuccess } from './history-port.js';
import type { InsightSource } from './record.js';

/** p8 전환기 fallback: 새 ':all' scope 저장본이 없을 때만 쓰는 구 top50 scope 목록(전일 조회 전용).
 *  오늘 수집·저장·캐시 재사용 경로는 이 목록을 조회하지 않는다. */
export const LEGACY_REQUEST_SCOPES: Readonly<Partial<Record<InsightSource, readonly string[]>>> = Object.freeze({
  'artificial-analysis': ['aa-v2:free:language-models:coding-intel-value-top50'],
  openrouter: ['rankings-daily:day:top50'],
});

/** 현재 scope 저장본이 있으면 그것을, 없으면 구 scope를 목록 순서대로 한 번 더 조회한다(전일 조회 전용). */
export function getDailyWithLegacyFallback(history: InsightHistoryPort, key: InsightDailyKey): InsightSuccess | undefined {
  const current = history.getDaily(key);
  if (current) return current;
  for (const scope of LEGACY_REQUEST_SCOPES[key.source] ?? []) {
    const legacy = history.getDaily({ ...key, requestScope: scope });
    if (legacy) return legacy;
  }
  return undefined;
}
