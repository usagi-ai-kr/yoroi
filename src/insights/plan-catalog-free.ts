/** 무료 전용 요금제 3개(tier: 'free'). 근거는 root가 공식 페이지를 직접 대조해 확정한 사실(2026-10-13)만 쓴다.
 *  - OpenCode Zen Free: https://opencode.ai/v2/docs/console/models — 기간 한정 무료, 수치 한도 미공개.
 *    조건 원문: "During its free period, collected data may be used to improve the model."(일부 zero-retention).
 *  - OpenCode Go Free: https://opencode.ai/v2/docs/console/go — Unlimited·기간 한정.
 *    실측 제약: x-opencode-session 헤더 필수(MissingSessionID)라 OpenCode 클라이언트 세션에서만 사용.
 *  - Antigravity Free: https://antigravity.google/docs/plans·/docs/models — "A meaningful quota, refreshed weekly",
 *    "A weekly rate limit" 원문, 수치 비공개.
 *  modelId는 AA 정규화 이름 기준이다. */
import type { PlanCatalogEntry, PlanModelEntry } from './plan-catalog.js';

const ZEN = 'https://opencode.ai/v2/docs/console/models';
const GO = 'https://opencode.ai/v2/docs/console/go';
const ANTIGRAVITY = 'https://antigravity.google/docs/plans';
const free = (modelId: string, displayName: string, sourceUrl: string): PlanModelEntry =>
  ({ modelId, displayName, sourceUrl, checkedOn: '2026-10-13', verified: true, free: true });
const list = (pairs: readonly (readonly [string, string])[], sourceUrl: string): readonly PlanModelEntry[] =>
  pairs.map(([displayName, modelId]) => free(modelId, displayName, sourceUrl));

export const FREE_PLANS: readonly PlanCatalogEntry[] = [
  { planId: 'opencode-zen-free', planName: 'OpenCode Zen Free', tier: 'free', models: list([
    ['Big Pickle', 'big-pickle'], ['Space Bunny Free', 'space-bunny'], ['LongCat 2.5 Preview Free', 'longcat-2-5-preview-free'],
    ['Step 5 Preview Free', 'step-5'], ['Exo Free', 'exo'], ['MiMo V2.6-Flash Free', 'mimo-v2-6-flash'],
    ['MiMo V2.5 Free', 'mimo-v2-5'], ['Ling 3.1 Flash Free', 'ling-3-1-flash'], ['Ling 3.0 Flash Fin Free', 'ling-3-0-flash-fin'],
    ['Nemotron 3 Ultra Free', 'nemotron-3-ultra'], ['Nemotron 3.5 Lightning Free', 'nemotron-3-5-lightning'],
    ['Muse Spark 1.3 Contributor Free', 'muse-spark-1-3'], ['Jev 1.13 Free', 'jev-1-13']], ZEN) },
  { planId: 'opencode-go-free', planName: 'OpenCode Go Free', tier: 'free', models: list([
    ['LongCat 2.5 Preview Free', 'longcat-2-5-preview-free'], ['Step 5 Preview Free', 'step-5']], GO) },
  { planId: 'antigravity-free', planName: 'Antigravity Free', tier: 'free', models: list([
    ['Gemini 3.8 Flash', 'gemini-3-8-flash'], ['Gemini 3.7 Flash', 'gemini-3-7-flash'], ['Gemini 3.6 Flash', 'gemini-3-6-flash'],
    ['Gemini 3.1 Pro', 'gemini-3-1-pro'], ['Claude Sonnet 4.6', 'claude-sonnet-4-6'], ['Claude Opus 4.6', 'claude-opus-4-6'],
    ['GPT-OSS-120b', 'gpt-oss-120b']], ANTIGRAVITY) },
];
