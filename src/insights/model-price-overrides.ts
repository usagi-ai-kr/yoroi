/** Off-peak 단가 override. 값은 공식 요금 문서 확인분만 넣는다(추측 금지). 확인일·출처 URL 필수.
 *  공급자별 시간대는 서로 다르므로 하나로 묶지 않는다. */
export interface OffPeakRate {
  readonly input: number; // USD / 1M input tokens (off-peak, cache miss)
  readonly output: number; // USD / 1M output tokens (off-peak)
  readonly sourceUrl: string;
  readonly checkedOn: string; // YYYY-MM-DD
  readonly provider: 'deepseek-platform' | 'ollama-cloud';
}

/** DeepSeek 플랫폼: peak = 월–금 UTC 01:00–04:00·06:00–10:00(중국 공휴일 제외), 그 외·주말·공휴일 전부 off-peak(반값).
 *  출처 https://api-docs.deepseek.com/quick_start/pricing (2026-10-12 확인). */
export const DEEPSEEK_OFF_PEAK_WINDOW = {
  provider: 'deepseek-platform', peakUtc: ['01:00-04:00', '06:00-10:00'], peakDays: 'Mon-Fri (CN holidays excluded)',
  offPeak: 'all other hours, weekends and CN holidays (rates are half of peak)',
  sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing', checkedOn: '2026-10-12' } as const;

/** Ollama Cloud: peak = 평일 UTC 12:00–18:00, off-peak = 평일 그 외 + 주말 전일(DeepSeek 플랫폼과 다른 창).
 *  출처 https://ollama.com/pricing (2026-10-12 확인). */
export const OLLAMA_OFF_PEAK_WINDOW = {
  provider: 'ollama-cloud', peakUtc: ['12:00-18:00'], peakDays: 'Mon-Fri',
  offPeak: 'weekdays outside 12:00-18:00 UTC, all weekend',
  sourceUrl: 'https://ollama.com/pricing', checkedOn: '2026-10-12' } as const;

export interface RegularRate {
  readonly input: number; // USD / 1M input tokens (cache miss)
  readonly output: number; // USD / 1M output tokens
  readonly sourceUrl: string;
  readonly checkedOn: string; // YYYY-MM-DD
  readonly provider: 'deepseek-platform' | 'ollama-cloud';
}

/** 검증된 공식 정상 단가(peak/일반 기준). */
export const REGULAR_RATES: Readonly<Record<string, RegularRate>> = {
  'deepseek-v4-1-flash': { input: 0.3, output: 1.2, sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing', checkedOn: '2026-10-12', provider: 'deepseek-platform' },
};

/** 검증된 off-peak 단가만 담는다. 같은 값이라도 공급자별 창은 위 상수로 분리해 기록한다. */
export const OFF_PEAK_RATES: Readonly<Record<string, OffPeakRate>> = {
  'deepseek-v4-1-flash': { input: 0.15, output: 0.6, sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing', checkedOn: '2026-10-12', provider: 'deepseek-platform' },
};

/** AA 표기 차이 대비 별칭(예: v4.1 → 4-1). 별칭→정식 키로 해석한다.
 *  deepseek-v4-flash: 공식 pricing 페이지가 "legacy 이름도 V4.1-Flash로 청구"라고 명시(조회 2026-10-12). */
export const OFF_PEAK_ALIASES: Readonly<Record<string, string>> = {
  'deepseek-4-1-flash': 'deepseek-v4-1-flash', 'deepseek-v4-flash': 'deepseek-v4-1-flash',
  'deepseek-v4.1-flash': 'deepseek-v4-1-flash', 'deepseek-4.1-flash': 'deepseek-v4-1-flash' };

/** off-peak 단가가 공개되지 않은 모델은 미확인으로만 남긴다(추측 금지). */
export const OFF_PEAK_TODO: readonly { readonly modelId: string; readonly note: string }[] = [
  { modelId: 'ollama-cloud-other-models', note: '미확인: Ollama 가격표에 off-peak 행이 있는 모델은 DeepSeek 2종뿐' },
];

export function findOffPeakRate(modelId: string, overrides: Readonly<Record<string, OffPeakRate>> = OFF_PEAK_RATES): OffPeakRate | undefined {
  const key = modelId.trim().toLowerCase();
  return overrides[key] ?? overrides[OFF_PEAK_ALIASES[key] ?? ''];
}

export function findRegularRate(modelId: string, rates: Readonly<Record<string, RegularRate>> = REGULAR_RATES): RegularRate | undefined {
  const key = modelId.trim().toLowerCase();
  return rates[key] ?? rates[OFF_PEAK_ALIASES[key] ?? ''];
}

/** DeepSeek 플랫폼: peak = 월–금 UTC 01:00–04:00·06:00–10:00, 그 외 off-peak. Ollama: peak = 평일 UTC 12:00–18:00, 그 외 off-peak.
 *  @param utcIsoTime UTC ISO 8601 timestamp (e.g. '2026-10-12T02:00:00Z'). */
export function isOffPeakHour(utcIsoTime: string, provider: 'deepseek-platform' | 'ollama-cloud'): boolean {
  const date = new Date(utcIsoTime);
  if (!Number.isFinite(date.getTime())) return false;
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const time = hour * 60 + minute;
  if (provider === 'deepseek-platform') {
    if (day === 0 || day === 6) return true;
    return !((time >= 60 && time < 240) || (time >= 360 && time < 600));
  }
  if (day === 0 || day === 6) return true;
  return !(time >= 720 && time < 1080);
}
