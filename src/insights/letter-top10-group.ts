export interface ModelVariant {
  readonly modelId: string;
  readonly baseModelId: string;
  readonly effort: string; // 'default' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  readonly value: number;
  readonly blendedCost?: number; // USD per 1M tokens; undefined = 가격 결측
  readonly effectiveCost?: number; // 혼합 단가 × AA effort cost_per_task 배율
  readonly costPerTask?: number;
  readonly costEfficiency?: number; // value / max(effectiveCost ?? blendedCost,0.01); undefined = 가격 결측
  readonly openrouterTokens?: number;
  readonly arenaRank?: number;
  readonly offPeak?: boolean; // off-peak 단가가 적용된 행
  readonly outputTokensPerSecond?: number; // AA median_output_tokens_per_second
}

export interface ModelGroup {
  readonly baseModelId: string;
  readonly repVariant: ModelVariant;
  readonly variants: readonly ModelVariant[];
  readonly isPareto: boolean;
}

const EFFORT_SUFFIXES = ['-minimal', '-low', '-medium', '-high', '-xhigh', '-max'] as const;

export function splitBaseAndEffort(rawId: string): { base: string; effort: string } {
  const trimmed = rawId.trim();
  for (const suffix of EFFORT_SUFFIXES) {
    if (trimmed.toLowerCase().endsWith(suffix)) {
      return { base: trimmed.slice(0, -suffix.length), effort: suffix.slice(1) };
    }
  }
  return { base: trimmed, effort: 'default' };
}

/** AA alias effort takes precedence; non-effort parenthetical tokens such as "Reasoning" are ignored. */
export function effortForModel(modelId: string, modelAlias?: string): string {
  const alias = modelAlias?.match(/\(([^)]*)\)/)?.[1]?.toLowerCase().split(/[^a-z]+/)
    .find(token => ['max', 'xhigh', 'high', 'medium', 'low', 'minimal'].includes(token));
  return alias ?? splitBaseAndEffort(modelId).effort;
}

/** 입력·출력 단가가 모두 finite >=0일 때만 계산한다. 한쪽이라도 결측/음수면 undefined(단가 -) —
 * 0 대입으로 무료·저가로 오인하지 않는다. 실제 0/0은 유효한 무료다. */
export function calcBlendedCost(inputCost?: number, outputCost?: number): number | undefined {
  if (!Number.isFinite(inputCost) || !Number.isFinite(outputCost)) return undefined;
  if ((inputCost as number) < 0 || (outputCost as number) < 0) return undefined;
  return (3 * (inputCost as number) + (outputCost as number)) / 4;
}
export function calcCostEfficiency(value: number, blendedCost?: number): number | undefined {
  return blendedCost === undefined ? undefined : value / Math.max(blendedCost, 0.01);
}

export function groupVariants(variants: readonly ModelVariant[]): ModelGroup[] {
  const groupsMap = new Map<string, ModelVariant[]>();
  for (const v of variants) {
    const list = groupsMap.get(v.baseModelId) ?? [];
    list.push(v);
    groupsMap.set(v.baseModelId, list);
  }

  const groups: { baseModelId: string; repVariant: ModelVariant; variants: ModelVariant[] }[] = [];
  for (const [baseModelId, list] of groupsMap.entries()) {
    list.sort((a, b) => (b.costEfficiency ?? -1) - (a.costEfficiency ?? -1) || b.value - a.value || a.modelId.localeCompare(b.modelId));
    groups.push({ baseModelId, repVariant: list[0]!, variants: list });
  }

  return groups.map(g => {
    const isDominated = groups.some(other => {
      if (other.baseModelId === g.baseModelId) return false;
      const o = other.repVariant, c = g.repVariant;
      if (o.blendedCost === undefined || c.blendedCost === undefined) return false; // 가격 결측은 파레토 판정 보류
      const cheaperOrEqual = o.blendedCost <= c.blendedCost;
      const betterOrEqual = o.value >= c.value;
      const strictlyBetter = o.blendedCost < c.blendedCost || o.value > c.value;
      return cheaperOrEqual && betterOrEqual && strictlyBetter;
    });
    return { ...g, isPareto: g.repVariant.blendedCost !== undefined && !isDominated };
  });
}
