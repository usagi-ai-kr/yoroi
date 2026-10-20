import type { InsightRunResult } from '../insights/run-once.js';
import { runThreeRolePipeline, type ThreeRolePipelineInput, type ThreeRolePipelineOutput } from '../insights/letter-three-role-pipeline.js';
import { buildReviewerCandidates } from './insights-reviewer-candidates.js';

/** InsightRunResult의 전체 풀 근거를 활용하여 3역할(오케스트레이터·리뷰어·워커) 파이프라인을 합성한다.
 *  리뷰어 후보는 toReviewerCandidates를 통해 3차원 정규 증거가 완비된 후보만 선별하며,
 *  결측 시 오케스트레이터 점수로 fallback(passthrough)하지 않고 빈 목록과 emptyCause/excluded를 명시한다. */
export function buildThreeRole(
  opt?: boolean | ThreeRolePipelineInput,
  run?: InsightRunResult,
  config?: { readonly depth?: 7 | 15 }
): ThreeRolePipelineOutput | undefined {
  if (!opt || (typeof opt === 'object' && opt.options?.enabled === false)) return undefined;
  const isObj = typeof opt === 'object';
  const recs = run?.top10?.records;
  const toCand = (r: { modelId: string; value?: number }) => ({
    modelId: r.modelId,
    ...(typeof r.value === 'number' && { score: r.value }),
  });
  const o = isObj && opt.orchestrator ? opt.orchestrator : (recs?.map(toCand) ?? []);
  const w = isObj && opt.worker ? opt.worker : o;

  if (isObj && opt.reviewer) {
    const out = runThreeRolePipeline({
      orchestrator: o,
      reviewer: opt.reviewer,
      worker: w,
      options: {
        enabled: true,
        ...(run?.publicationDate !== undefined && { publicationDate: run.publicationDate }),
        ...(config?.depth !== undefined && { depth: config.depth }),
        ...(opt.options ?? {}),
      },
    });
    // #195 리뷰 F3: 명시적 reviewer 경로에서도 리뷰어가 비면 사유를 남긴다(미확인이라고 날조하지 않음).
    if ((out.selection?.reviewer.all.length ?? 0) > 0) return out;
    const provided = opt.reviewer.length;
    return { ...out, emptyCause: provided === 0
      ? 'no reviewer candidates provided (explicit input)'
      : 'no reviewer candidate assigned after orchestrator/reviewer alternation and reviewer policy' };
  }

  const revOutcome = buildReviewerCandidates(run?.top10);
  const r = revOutcome.candidates;
  const reviewerPolicy = isObj && opt.options?.reviewerPolicy
    ? opt.options.reviewerPolicy
    : { weights: revOutcome.weights };

  const pipelineOutput = runThreeRolePipeline({
    orchestrator: o,
    reviewer: r,
    worker: w,
    options: {
      enabled: true,
      ...(run?.publicationDate !== undefined && { publicationDate: run.publicationDate }),
      ...(config?.depth !== undefined && { depth: config.depth }),
      ...(isObj ? opt.options : {}),
      ...(reviewerPolicy !== undefined && { reviewerPolicy }),
    },
  });

  return {
    ...pipelineOutput,
    ...(revOutcome.emptyCause !== undefined && { emptyCause: revOutcome.emptyCause }),
    ...(revOutcome.excluded.length > 0 && { excluded: revOutcome.excluded }),
  };
}
