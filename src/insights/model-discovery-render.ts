import type { DiscoveryDiffSummary } from './model-discovery-types.js';

/** detect 스타일(중계: src/ui/cli/detect-render.ts) — 크리덴셜·경로·자유문자열을 넣지 않고,
 *  제어문자(ANSI 포함)는 제거하고 길이를 제한한다. */
const clean = (value: string, limit = 64): string =>
  value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, limit);

/** stdout 1줄: `<observedAt> discovery registry-diff providers=N added=N removed=N changed=N`.
 *  provider id·모델 id·경로는 넣지 않는다(자유문자열 유입 차단). */
export function renderDiscoveryDiffLine(summary: DiscoveryDiffSummary): string {
  const head = [clean(summary.observedAt), 'discovery', 'registry-diff'].join(' ');
  return `${head} providers=${summary.providers} added=${summary.added} removed=${summary.removed} changed=${summary.changed}`;
}

/** 변경이 없으면 알림을 내지 않는다(undefined). 알림 채널은 stdout 한 줄뿐이다. */
export function renderDiscoveryDiffNotice(summary: DiscoveryDiffSummary): string | undefined {
  if (summary.added === 0 && summary.removed === 0 && summary.changed === 0) return undefined;
  return renderDiscoveryDiffLine(summary);
}
