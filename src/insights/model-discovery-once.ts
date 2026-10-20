import type { ModelDiscoveryConfig } from './model-discovery-config.js';
import { runModelDiscovery, type DiscoveryRunnerOptions } from './model-discovery-runner.js';

/** #168 단위8: once 수집 뒤 실행하는 기본 꺼짐 감지 어댑터. 감지 실패는 once를 실패시키지 않고 알림만 남긴다. */
export interface OnceDiscoveryOptions extends Omit<DiscoveryRunnerOptions, 'config'> {
  /** 생략하거나 enabled가 true가 아니면 아무것도 하지 않는다(네트워크·저장소 접근 없음). */
  readonly config?: ModelDiscoveryConfig;
}

export interface OnceDiscoveryNotice {
  /** stdout/진단용 1줄 요약. */
  readonly notice: string;
  readonly errors: number;
}

/** 꺼짐/미지정이면 undefined. 켜졌으면 diff 요약 1줄(자동 편입·카탈로그 변경 없음). */
export async function runOnceDiscovery(options?: OnceDiscoveryOptions): Promise<OnceDiscoveryNotice | undefined> {
  if (options?.config?.enabled !== true) return undefined;
  try {
    const { config, ...rest } = options;
    const res = await runModelDiscovery({ ...rest, config });
    const s = res.summary;
    return { errors: s.errors,
      notice: `[model-discovery] providers ${s.providers} · +${s.added} -${s.removed} ~${s.changed}` + (s.errors ? ` · errors ${s.errors}` : '') };
  } catch (err) {
    return { errors: 1, notice: `[model-discovery] failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200) };
  }
}
