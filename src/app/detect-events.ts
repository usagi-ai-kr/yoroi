import type { UsageDetectEvent } from './detect-usage.js';

/** Zen lock detector events (#89). Ids, numbers and ISO times only: never lock reasons from the
 * network, response bodies, conversations or credentials. `model` must pass `safeModelId`. */
export type ZenDetectEvent =
  | { readonly kind: 'exceeded'; readonly eventId: number; readonly observedAt: string;
      readonly model?: string; readonly retryAt?: string }
  | { readonly kind: 'cleared'; readonly eventId: number; readonly observedAt: string; readonly model?: string }
  /** The recorded retry time has passed; the lock itself stays unverified until a real `--ok`. */
  | { readonly kind: 'retry-passed'; readonly observedAt: string; readonly retryAt: string; readonly model?: string }
  /** An OpenCode process started after the last recorded plugin load (`loadedAt` absent: never recorded). */
  | { readonly kind: 'plugin-stale'; readonly observedAt: string; readonly processStartedAt?: string;
      readonly loadedAt?: string; /** v2 마커 판정(p43): 설치 마커 버전. processStartedAt 대신 표시된다. */
      readonly marker?: 'v1' | 'v2' };

/** The detector itself was not running between two heartbeats (reboot, logout, crash). */
export interface DetectorGapEvent { readonly kind: 'detector-gap'; readonly observedAt: string; readonly gapMs: number }

/** Every notification the detector can emit. `kind` values are unique across all sources. */
export type DetectEvent = ZenDetectEvent | UsageDetectEvent | DetectorGapEvent;
export type DetectEventSource = 'zen' | 'usage' | 'detector';

const ZEN_KINDS: ReadonlySet<string> = new Set(['exceeded', 'cleared', 'retry-passed', 'plugin-stale']);
const USAGE_KINDS: ReadonlySet<string> = new Set(['exhausted', 'recovered', 'surge', 'stale', 'resumed']);

export function detectEventSource(event: DetectEvent): DetectEventSource {
  if (ZEN_KINDS.has(event.kind)) return 'zen';
  return USAGE_KINDS.has(event.kind) ? 'usage' : 'detector';
}

/** Same shape the `zen-free --json` output accepts; anything else is dropped rather than echoed. */
export function safeModelId(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,63}$/.test(value) ? value : undefined;
}
