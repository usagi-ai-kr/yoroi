import { detectEventSource, type DetectEvent } from "../../app/detect-events.js";
import type { DetectLease } from "../../app/detect-state-port.js";

/** Untrusted ids (window names, models) lose control characters and are bounded before printing. */
const clean = (value: string, limit = 64): string => value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").slice(0, limit);
const minutes = (ms: number): string => `${Math.max(0, Math.round(ms / 60_000))}m`;
const num = (key: string, value: number | undefined): string[] => (value === undefined ? [] : [`${key}=${Number(value.toFixed(2))}`]);

/** One line per event: `<time> <source> <what> <details>`; no credentials, paths or free text. */
export function renderDetectEvent(event: DetectEvent): string {
  const head = `${event.observedAt} ${detectEventSource(event)}`;
  const part = (...items: (string | undefined | string[])[]): string => [head, ...items.flat().filter(Boolean)].join(" ");
  switch (event.kind) {
    case "exceeded": return part("exceeded", event.model && `model=${clean(event.model)}`, event.retryAt && `retry=${event.retryAt}`);
    case "cleared": return part("cleared", event.model && `model=${clean(event.model)}`);
    case "retry-passed": return part("retry-passed", event.model && `model=${clean(event.model)}`, `retry=${event.retryAt}`, "(unverified)");
    case "plugin-stale": return part("plugin-stale", event.processStartedAt && `opencode-started=${event.processStartedAt}`,
      event.marker && `marker=${event.marker}`, `plugin-loaded=${event.loadedAt ?? "never"}`);
    case "detector-gap": return part("gap", `${minutes(event.gapMs)} without heartbeat`);
    default: {
      const subject = `${event.provider}/${clean(event.windowId)}`;
      const extra = event.kind === "surge" ? [`+${Number((event.deltaPercent ?? 0).toFixed(2))}%p`, `in=${minutes(event.elapsedMs ?? 0)}`]
        : event.kind === "stale" ? [`age=${minutes(event.ageMs ?? 0)}`] : [...(event.reason ? [`(${event.reason})`] : []), ...num("percent", event.percent), ...num("remaining", event.remaining)];
      return part(subject, event.kind, extra);
    }
  }
}
export const renderDetectEventJson = (event: DetectEvent): string => JSON.stringify({ source: detectEventSource(event), ...event });

export interface DetectStatusView { readonly state: "running" | "stopped" | "unknown"; readonly lastHeartbeatAt: string | null; readonly ageMs: number | null; readonly expiresAt: string | null }
/** running: lease still valid; stopped: lease expired (no heartbeat for 2 intervals); unknown: no active detector (never started or stopped cleanly). */
export function detectStatus(lease: DetectLease | undefined, nowMs: number): DetectStatusView {
  if (!lease) return { state: "unknown", lastHeartbeatAt: null, ageMs: null, expiresAt: null };
  return { state: lease.expiresAtMs > nowMs ? "running" : "stopped", lastHeartbeatAt: new Date(lease.renewedAtMs).toISOString(),
    ageMs: Math.max(0, nowMs - lease.renewedAtMs), expiresAt: new Date(lease.expiresAtMs).toISOString() };
}
export function renderDetectStatus(view: DetectStatusView): string {
  if (view.state === "unknown") return "detect: no active detector (no heartbeat recorded)";
  return `detect: ${view.state} last-heartbeat=${view.lastHeartbeatAt} age=${minutes(view.ageMs ?? 0)} lease-expires=${view.expiresAt}`;
}
