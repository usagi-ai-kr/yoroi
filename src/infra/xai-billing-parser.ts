import { SourceError } from '../app/usage-source.js';
import type { UsageWindow } from '../domain/usage.js';

/** 실측 스키마(2026-10-15, w1 1회): { config: { creditUsagePercent, currentPeriod:{type,start,end} } }. */
export const USAGE_PERIOD_WEEKLY = 'USAGE_PERIOD_TYPE_WEEKLY';
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function fail(): never { throw new SourceError('parse'); }

/** config → 주간 percent 창. 결손·범위밖(0~100 밖)·날짜 오류는 parse 오류. 비-WEEKLY는 값 보존 + fallback id 'usage'. */
export function parseXaiBilling(raw: unknown): readonly UsageWindow[] {
  if (!isObject(raw) || !isObject(raw['config'])) fail();
  const config = raw['config'];
  const percent = config['creditUsagePercent'];
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) fail();
  const period = config['currentPeriod'];
  if (!isObject(period)) fail();
  const { type, start, end } = period;
  if (typeof type !== 'string' || typeof start !== 'string' || typeof end !== 'string') fail();
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) fail();
  const id = type === USAGE_PERIOD_WEEKLY ? 'weekly' : 'usage';
  return [{ id, unit: 'percent', percent, resetAt: end, periodStart: start }];
}
