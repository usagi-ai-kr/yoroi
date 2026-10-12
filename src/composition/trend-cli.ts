import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { UsageHistory, UsageObservation } from '../app/usage-history-port.js';
import { computeTrendStats, type TrendPeriod, type TrendPeriodStats } from '../domain/trend-calc.js';
import { DB_FILE_NAME, resolveDataDir } from '../infra/sqlite/data-dir.js';
import { isBusy } from '../infra/sqlite/usage-cache-store.js';
import { openUsageHistoryReadonly } from '../infra/sqlite/usage-history-store.js';
import type { CliEnvironment } from '../ui/cli/bootstrap.js';
import type { TrendParsedArgs } from '../ui/cli/trend-args.js';
import {
  renderTrendJsonl, renderTrendPretty, renderTrendText, type SeriesTrendResult,
} from '../ui/cli/trend-render.js';

export interface TrendCliOptions {
  readonly env: CliEnvironment;
  readonly dataEnv: NodeJS.ProcessEnv;
  readonly openHistory?: () => UsageHistory;
  readonly now?: () => number;
}

const PERIOD_MS: Record<TrendPeriod, number> = {
  '24h': 24 * 3600 * 1000, '7d': 7 * 24 * 3600 * 1000, '30d': 30 * 24 * 3600 * 1000,
};

function extractVal(obs: UsageObservation): number | null {
  const w = obs.window;
  return (w.unit === '%' || w.unit === 'percent' || w.percent !== undefined)
    ? (w.percent ?? null) : (w.used ?? w.remaining ?? null);
}

function groupBySeries(samples: readonly UsageObservation[]): Map<string, UsageObservation[]> {
  const groups = new Map<string, UsageObservation[]>();
  for (const s of samples) {
    const key = `${s.provider}\0${s.scope}\0${s.contractVersion}\0${s.window.id}\0${s.window.unit}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  return groups;
}

function buildSeriesResult(samples: UsageObservation[], args: TrendParsedArgs, nowMs: number): SeriesTrendResult {
  const first = samples[0]!;
  const periods: Partial<Record<TrendPeriod, TrendPeriodStats>> = {};
  if (args.since) periods[args.since] = computeTrendStats(samples, args.since, nowMs);
  else {
    periods['24h'] = computeTrendStats(samples, '24h', nowMs);
    periods['7d'] = computeTrendStats(samples, '7d', nowMs);
  }
  return {
    provider: first.provider, windowId: first.window.id, unit: first.window.unit,
    contractVersion: first.contractVersion, periods, sparklinePoints: samples.map(extractVal),
  };
}

export async function runTrendCli(args: TrendParsedArgs, options: TrendCliOptions): Promise<number> {
  const { env, dataEnv } = options;
  if (!options.openHistory && !existsSync(join(resolveDataDir(dataEnv), DB_FILE_NAME))) {
    env.stdout('이력 없음\n');
    return 0;
  }
  let history: UsageHistory;
  try { history = options.openHistory ? options.openHistory() : openUsageHistoryReadonly(dataEnv); }
  catch (err) { env.stderr(isBusy(err) ? 'trend: storage busy\n' : 'trend: storage error\n'); return 1; }
  try {
    const nowMs = options.now?.() ?? Date.now();
    const periodForQuery: TrendPeriod = args.since ?? '7d';
    const sinceIso = new Date(nowMs - PERIOD_MS[periodForQuery]).toISOString();
    const filter = {
      sinceIso,
      ...(args.provider && { provider: args.provider }),
      ...(args.windowId && { windowId: args.windowId }),
    };
    if (typeof history.queryObservations !== 'function') { env.stderr('trend: history query unsupported\n'); return 1; }
    const samples = history.queryObservations(filter);
    if (samples.length === 0) { env.stdout('이력 없음\n'); return 0; }

    const results = Array.from(groupBySeries(samples).values())
      .map(seriesSamples => buildSeriesResult(seriesSamples, args, nowMs));
    const lines = args.json ? renderTrendJsonl(results)
      : args.pretty ? renderTrendPretty(results) : renderTrendText(results, args.since);
    for (const line of lines) env.stdout(`${line}\n`);
    return 0;
  } catch (err) {
    env.stderr(isBusy(err) ? 'trend: storage busy\n' : 'trend: storage error\n');
    return 1;
  } finally {
    try { history.close(); } catch { /* ignore close error */ }
  }
}
