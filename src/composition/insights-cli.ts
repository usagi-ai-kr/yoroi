import { opencodeTarget } from '../config/load-config.js';
import { runInsights } from './insights.js';
import { renderTop10FromRecords } from '../insights/letter-top10-render.js';
import { joinLetterParts, renderLetterPartsFromRecords, type LetterParts } from '../insights/letter-markdown.js';
import { publishInsightsLetter } from './insights-publish.js';
import { replaceLegacyRoleBlocks } from '../insights/letter-three-role-body.js';
import { letterThreeRoleConfig } from '../config/letter-three-role.js';
import { renderThreeRoleSection } from '../insights/letter-three-role-render.js';
import type { ThreeRolePipelineOutput } from '../insights/letter-three-role-pipeline.js';
import { NodeProcessRunner } from '../infra/process-runner.js';
import type { ProcessRunner } from '../infra/process-port.js';
import type { InsightHistoryPort } from '../insights/history-port.js';
import type { InsightSourcePort } from '../insights/source-port.js';
import type { InsightPortOptions } from '../insights/sources.js';
import type { HttpClient } from '../infra/http-client.js';
import type { CliEnvironment } from '../ui/cli/bootstrap.js';
import type { InsightsParsedArgs } from '../ui/cli/insights-args.js';
import { runInsightsCommand, type InsightsCommandDeps } from '../ui/cli/insights-command.js';
import type { InsightLetterView } from '../ui/cli/insights-view.js';

/** Composition-owned wiring options. Tests inject history/ports/clock; production passes none.
 * HTTP keys come from the config env and are never logged. */
export interface InsightsCliOptions {
  readonly http?: HttpClient;
  readonly processRunner?: ProcessRunner;
  readonly clock?: () => number;
  readonly sourceOptions?: Omit<InsightPortOptions, 'now'>;
  readonly openHistory?: () => InsightHistoryPort & { close(): void };
  readonly createPorts?: (client: HttpClient, lookup: (name: string) => string | undefined,
    options: InsightPortOptions) => readonly InsightSourcePort[];
}

export function composeThreeRoleComments(parts: LetterParts, threeRole: ThreeRolePipelineOutput): LetterParts['comments'] {
  const t = threeRole.selection?.top15; if (!t) return parts.comments;
  return [renderThreeRoleSection('orchestrator', t.orchestrator, 15), renderThreeRoleSection('reviewer', t.reviewer, 15) + (t.reviewer.length === 0 && threeRole.emptyCause ? `\n\n- 제외 사유: ${threeRole.emptyCause}` : ''), `${renderThreeRoleSection('worker', t.worker, 15)}\n\n${parts.comments[2]}`];
}
/** env opt-in → runInsights threeRole 입력. off면 빈 객체다. */
export const threeRoleInputFromEnv = (configEnv: Readonly<Record<string, string | undefined>>): { threeRole: true } | Record<string, never> =>
  letterThreeRoleConfig(configEnv).enabled ? { threeRole: true as const } : {};

/** Wires `yoroi insights once` to the existing internal run (O1). Opens and closes one history per run;
 * output, exit codes and abort handling stay in the ui command. No delivery, scheduling or LLM here. */
export function runInsightsCli(parsed: Extract<InsightsParsedArgs, { kind: 'insights' }>, ctx: {
  readonly env: CliEnvironment;
  readonly subscribeSignals: (handler: () => void) => () => void;
  readonly configEnv: Readonly<Record<string, string | undefined>>;
  readonly dataEnv: NodeJS.ProcessEnv;
  readonly options?: InsightsCliOptions;
}): Promise<number> {
  const opts = ctx.options;
  const runner = opts?.processRunner ?? new NodeProcessRunner();
  // 미지원 설정값은 수집을 시작하기 전에 설정 오류(exit 2)로 끝낸다(docs/development.md 설정 절).
  try { opencodeTarget(ctx.configEnv); } catch (error) { ctx.env.stderr(`insights: ${error instanceof Error ? error.message : 'Invalid runtime configuration'}`); return Promise.resolve(2); }
  if (parsed.operation === 'publish') {
    const controller = new AbortController(), unsubscribe = ctx.subscribeSignals(() => controller.abort());
    return publishInsightsLetter({ ...(parsed.dryRun && { dryRun: true }), ...(parsed.notBefore && { notBefore: parsed.notBefore }), runner,
      ...(ctx.configEnv.YOROI_GH_BIN && { ghBin: ctx.configEnv.YOROI_GH_BIN }), ...(opts?.clock && { clock: opts.clock }),
      signal: controller.signal, render: async () => {
        const outcome = await runInsights({ env: ctx.configEnv, dataEnv: ctx.dataEnv, processRunner: runner,
          ...(opts?.http && { http: opts.http }), ...(opts?.clock && { clock: opts.clock }),
          ...(opts?.sourceOptions && { sourceOptions: opts.sourceOptions }),
          ...(opts?.openHistory && { openHistory: opts.openHistory }), ...(opts?.createPorts && { createPorts: opts.createPorts }),
          signal: controller.signal, ...threeRoleInputFromEnv(ctx.configEnv) });
        if (outcome.exitCode !== 0) throw new Error('insights run failed');
        const top10 = outcome.top10 ?? { records: [], openrouterRecords: [], previousRanks: [], failedSources: [] };
        const warnings = (top10 as { warnings?: readonly string[] }).warnings;
        const partialSources = outcome.sources.filter(s => s.partial === true).map(s => s.source);
        const parts = renderLetterPartsFromRecords({ publicationDate: outcome.publicationDate, ...top10,
          ...(warnings?.length && { notes: warnings }), ...(partialSources.length && { partialSources }) });
        const threeRole = outcome.threeRole;
        if (!threeRole?.sections || !threeRole.selection) return parts;
        return { body: replaceLegacyRoleBlocks(parts.body, threeRole.sections),
          comments: composeThreeRoleComments(parts, threeRole) };
      } }, ctx.env).finally(() => { unsubscribe(); controller.abort(); });
  }
  const deps: InsightsCommandDeps = {
    subscribeSignals: ctx.subscribeSignals,
    run: async ({ refresh, signal }) => {
      const outcome = await runInsights({ env: ctx.configEnv, dataEnv: ctx.dataEnv,
        ...(opts?.http && { http: opts.http }), ...(opts?.clock && { clock: opts.clock }),
        processRunner: runner,
        ...(opts?.sourceOptions && { sourceOptions: opts.sourceOptions }),
        ...(opts?.openHistory && { openHistory: opts.openHistory }), ...(opts?.createPorts && { createPorts: opts.createPorts }),
        ...(refresh && { refresh: true }), ...(signal && { signal }), ...threeRoleInputFromEnv(ctx.configEnv) });
      const letter: InsightLetterView = outcome.letter;
      const top10 = outcome.top10 ?? { records: [], openrouterRecords: [], previousRanks: [], failedSources: [] };
      const warnings = (top10 as { warnings?: readonly string[] }).warnings;
      const partialSources = outcome.sources.filter(s => s.partial === true).map(s => s.source);
      const top10Payload = { publicationDate: outcome.publicationDate, ...top10, ...(warnings && warnings.length ? { notes: warnings } : {}),
        ...(partialSources.length ? { partialSources } : {}) };
      const sections = outcome.threeRole?.sections;
      const compactText = renderTop10FromRecords(top10Payload);
      const markdownRaw = joinLetterParts(renderLetterPartsFromRecords(top10Payload));
      return { letter, storage: outcome.storage,
        compact: sections ? replaceLegacyRoleBlocks(compactText, sections) : compactText,
        markdown: sections ? replaceLegacyRoleBlocks(markdownRaw, sections) : markdownRaw };
    },
  };
  return runInsightsCommand(parsed, deps, ctx.env);
}
