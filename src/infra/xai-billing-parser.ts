import { SourceError } from '../app/usage-source.js';
import type { UsageWindow } from '../domain/usage.js';

/** 실측 스키마(2026-10-15, w1 1회): { config: { creditUsagePercent, currentPeriod:{type,start,end} } }.
 *  17:07 신 스키마: creditUsagePercent 부재 + prepaidBalance 등 추가 — prepaidBalance는 사용률로 해석하지 않는다. */
export const USAGE_PERIOD_WEEKLY = 'USAGE_PERIOD_TYPE_WEEKLY';
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function fail(): never { throw new SourceError('parse'); }
/** percent는 있으면 0~100 유한수만 허용(타입·범위 오류는 parse). 부재는 undefined로 통과시킨다. */
function validPercent(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) fail();
  return value;
}

/** config → 주간 percent 창. 결손·범위밖(0~100 밖)·날짜 오류는 parse 오류. 비-WEEKLY는 값 보존 + fallback id 'usage'.
 *  creditUsagePercent 부재(신 스키마)면 값을 만들지 않고 percent 없는 행(unit 'percent'·resetAt/periodStart만)을 돌려준다. */
export function parseXaiBilling(raw: unknown): readonly UsageWindow[] {
  if (!isObject(raw) || !isObject(raw['config'])) fail();
  const config = raw['config'];
  const percent = validPercent(config['creditUsagePercent']);
  const period = config['currentPeriod'];
  if (!isObject(period)) fail();
  const { type, start, end } = period;
  if (typeof type !== 'string' || typeof start !== 'string' || typeof end !== 'string') fail();
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) fail();
  const id = type === USAGE_PERIOD_WEEKLY ? 'weekly' : 'usage';
  return [{ id, unit: 'percent', resetAt: end, periodStart: start, ...(percent !== undefined && { percent }) }];
}
