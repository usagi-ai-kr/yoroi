/** 사용자 보유 5개 요금제 → 사용 가능 모델 매핑. 근거는 공식 pricing/플랜 페이지 1회 조회(2026-10-12)이며,
 *  항목마다 sourceUrl·checkedOn·verified를 가진다. 페이지에서 확인되지 않은 모델은 넣지 않는다(보고서 '미확인').
 *  modelId는 AA 정규화 이름(소문자·점→하이픈) 기준이다. */
export interface UsageLimit {
  readonly count: number;
  readonly period: string;
  readonly note?: string;
  readonly sourceUrl: string;
  readonly checkedOn: string;
}
export interface PlanModelEntry {
  readonly modelId: string;
  readonly displayName: string;
  readonly sourceUrl: string;
  readonly checkedOn: string;
  readonly verified: boolean;
  readonly usageLimit?: UsageLimit;
}
export interface PlanUsagePolicy {
  readonly credit: string;
  readonly pricingModel: string;
  readonly concurrency: number;
  readonly sourceUrl: string;
  readonly checkedOn: string;
}
export interface PlanCatalogEntry {
  readonly planId: string;
  readonly planName: string;
  readonly models: readonly PlanModelEntry[];
  readonly usagePolicy?: PlanUsagePolicy;
}

const CHECKED_ON = '2026-10-12', CHECKED_ON_DOCS = '2026-10-13';
const OPENAI = 'https://openai.com/chatgpt/pricing/';
const ANTHROPIC = 'https://www.anthropic.com/pricing';
const GOOGLE = 'https://one.google.com/about/google-ai-plans/';
const OLLAMA = 'https://ollama.com/pricing';
const OPENCODE = 'https://opencode.ai/go';
const OPENCODE_DOCS = 'https://opencode.ai/v2/docs/console/go';
const m = (modelId: string, displayName: string, sourceUrl: string): PlanModelEntry =>
  ({ modelId, displayName, sourceUrl, checkedOn: CHECKED_ON, verified: true });
const mDocs = (modelId: string, displayName: string, sourceUrl: string): PlanModelEntry =>
  ({ modelId, displayName, sourceUrl, checkedOn: CHECKED_ON_DOCS, verified: true });

export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  { planId: 'chatgpt-plus', planName: 'ChatGPT Plus', models: ['GPT-6.1 Sol|gpt-6-1-sol', 'GPT-6 Astra|gpt-6-astra',
    'GPT-6 Sol|gpt-6-sol', 'GPT-6 Luna|gpt-6-luna', 'GPT-5.6 Sol|gpt-5-6-sol', 'GPT-5.6 Terra|gpt-5-6-terra',
    'GPT-5.6 Luna|gpt-5-6-luna', 'GPT-5 Thinking Mini|gpt-5-thinking-mini']
    .map(s => m(s.split('|')[1]!, s.split('|')[0]!, OPENAI)) },
  { planId: 'claude-pro', planName: 'Claude Pro', models: ['Claude Opus 5.5|claude-opus-5-5', 'Claude Sonnet 5.5|claude-sonnet-5-5',
    'Claude Haiku 5.5|claude-haiku-5-5'].map(s => m(s.split('|')[1]!, s.split('|')[0]!, ANTHROPIC)) },
  { planId: 'google-ai-pro', planName: 'Google AI Pro', models: ['Gemini 3.1 Pro|gemini-3-1-pro', 'Gemini 3 Pro|gemini-3-pro']
    .map(s => m(s.split('|')[1]!, s.split('|')[0]!, GOOGLE)) },
  { planId: 'ollama-cloud-pro', planName: 'Ollama Cloud Pro',
    usagePolicy: { credit: '$60/월', pricingModel: '토큰 단가 차감', concurrency: 3, sourceUrl: OLLAMA, checkedOn: CHECKED_ON },
    models: ['DeepSeek V4.1 Flash|deepseek-v4-1-flash', 'DeepSeek V4 Pro|deepseek-v4-pro',
    'Gemma 4|gemma4', 'GLM-5.3|glm-5-3', 'GLM-5.3-Flash|glm-5-3-flash', 'GLM-5.2|glm-5-2', 'gpt-oss:120b|gpt-oss-120b',
    'gpt-oss:20b|gpt-oss-20b', 'Kimi K3|kimi-k3', 'Kimi K2.7 Code|kimi-k2-7-code', 'Kimi K2.6|kimi-k2-6', 'MiniMax M3|minimax-m3',
    'MiniMax M2.7|minimax-m2-7', 'Mistral Large 4|mistral-large-4', 'Mistral Large 3|mistral-large-3',
    'Nemotron 3 Nano|nvidia-nemotron-3-nano-30b-a3b-reasoning',
    'Nemotron 3 Super|nemotron-3-super', 'Nemotron 3 Ultra|nemotron-3-ultra'].map(s => m(s.split('|')[1]!, s.split('|')[0]!, OLLAMA)) },
  { planId: 'opencode-go-plus', planName: 'OpenCode Go Plus', models: [
    { ...m('kimi-k3', 'Kimi K3', OPENCODE), usageLimit: { count: 440, period: '5h', note: 'Est. requests / 5h: 440 (Plus)', sourceUrl: OPENCODE, checkedOn: CHECKED_ON } },
    ...['Kimi K2.7 Code|kimi-k2-7-code', 'Space Bunny|space-bunny', 'MiniMax M3|minimax-m3', 'Claude Haiku 5.5|claude-haiku-5-5',
    'GPT 6 Luna|gpt-6-luna', 'Qwen3.7 Plus|qwen3-7-plus', 'GLM-5.3-Flash|glm-5-3-flash', 'DeepSeek V4.1 Flash|deepseek-v4-1-flash',
    'MiMo-V2.6-Flash|mimo-v2-6-flash', 'Muse Spark 1.3 Contributor|muse-spark-1-3',
    'LongCat 2.5 Preview Free|longcat-2-5-preview-free', 'Step 5 Preview Free|step-5']
    .map(s => m(s.split('|')[1]!, s.split('|')[0]!, OPENCODE)),
    ...['GPT 5.6 Luna|gpt-5-6-luna', 'GLM-5.3|glm-5-3', 'GLM-5.2|glm-5-2', 'Kimi K2.6|kimi-k2-6', 'LongCat-2.0|longcat-2-0',
    'MiMo-V2.6-Pro|mimo-v2-6-pro', 'MiMo-V2.5|mimo-v2-5', 'MiMo-V2.5-Pro|mimo-v2-5-pro', 'MiniMax M2.7|minimax-m2-7',
    'Muse Spark 1.2 Contributor|muse-spark-1-2', 'Qwen3.8 Max|qwen3-8-max', 'Qwen3.8 Flash|qwen3-8-flash',
    'DeepSeek V4 Pro|deepseek-v4-pro', 'DeepSeek V4 Flash|deepseek-v4-flash',
    'DeepSeek V4 Flash Vision Exp|deepseek-v4-flash-vision-exp', 'Hy4 preview|hy4-preview', 'Hy3|hy3',
    'Grok 4.7|grok-4-7', 'Grok 4.6|grok-4-6'].map(s => mDocs(s.split('|')[1]!, s.split('|')[0]!, OPENCODE_DOCS))] },
];
