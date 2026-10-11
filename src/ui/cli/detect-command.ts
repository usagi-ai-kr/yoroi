import type { DetectEvent } from "../../app/detect-events.js";
import { DEFAULT_DETECT_INTERVAL_MS, runFixedSchedule, type DetectSleep } from "../../app/detect-scheduler.js";
import type { DetectLease } from "../../app/detect-state-port.js";
import type { CliEnvironment } from "./bootstrap.js";
import type { DetectParsedArgs } from "./detect-args.js";
import { detectStatus, renderDetectEvent, renderDetectEventJson, renderDetectStatus } from "./detect-render.js";

/** Structural view of the composition's cycle result (ui never imports composition). */
export interface DetectCycleView {
  readonly events: readonly DetectEvent[]; readonly errors: readonly string[]; readonly skipped?: "lease-held"; readonly fenced?: true;
}
export interface DetectCommandDeps {
  readonly runCycle: (signal: AbortSignal) => Promise<DetectCycleView>;
  readonly readLease: () => DetectLease | undefined;
  readonly releaseLease: () => void;
  readonly now: () => number;
  readonly sleep: DetectSleep;
  readonly intervalMs?: number;
  readonly subscribeSignals: (handler: () => void) => () => void;
}

/** stdout carries only events (one line each, or JSONL); diagnostics go to stderr as component/code only. */
export async function runDetectCommand(parsed: Extract<DetectParsedArgs, { kind: "detect" }>, deps: DetectCommandDeps, env: CliEnvironment): Promise<number> {
  if (parsed.operation === "status") {
    try {
      const view = detectStatus(deps.readLease(), deps.now());
      env.stdout(parsed.json ? JSON.stringify(view) : renderDetectStatus(view));
      return 0;
    } catch { env.stderr("detect: status storage error"); return 1; }
  }
  const controller = new AbortController(), unsubscribe = deps.subscribeSignals(() => controller.abort());
  let waiting = false;
  const cycle = async (): Promise<void> => {
    const result = await deps.runCycle(controller.signal);
    for (const event of result.events) env.stdout(parsed.json ? renderDetectEventJson(event) : renderDetectEvent(event));
    for (const code of result.errors) env.stderr(`detect: ${code}`);
    if (result.fenced) env.stderr("detect: lease lost to another detector");
    if (result.skipped && !waiting) env.stderr("detect: another detector holds the lease; waiting for it to expire");
    waiting = result.skipped !== undefined;
  };
  try {
    if (parsed.operation === "once") { await cycle(); return 0; }
    await runFixedSchedule(cycle, controller.signal, { sleep: deps.sleep, now: deps.now, intervalMs: deps.intervalMs ?? DEFAULT_DETECT_INTERVAL_MS,
      onCycleError: () => env.stderr("detect: cycle failed") });
    return 0;
  } catch { env.stderr("detect: stopped unexpectedly"); return 1; }
  finally { unsubscribe(); try { deps.releaseLease(); } catch { /* shutdown never fails the exit code */ } }
}
