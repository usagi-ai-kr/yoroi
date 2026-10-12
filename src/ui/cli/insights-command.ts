import type { CliEnvironment } from "./bootstrap.js";
import type { InsightsParsedArgs } from "./insights-args.js";
import { renderInsights } from "./insights-render.js";
import type { InsightLetterView } from "./insights-view.js";

/** Structural view of one composition run; ui never imports the insights core. */
export interface InsightsRunView {
  readonly letter: InsightLetterView;
  /** `memory` means the database could not be opened: the letter still works without history. */
  readonly storage: "sqlite" | "memory";
  /** Composition-built compact top-10 text (uncapped records); used for the default/pretty output. */
  readonly compact?: string;
}
export interface InsightsCommandDeps {
  readonly run: (options: { readonly refresh?: boolean; readonly signal?: AbortSignal }) => Promise<InsightsRunView>;
  readonly subscribeSignals: (handler: () => void) => () => void;
  /** Optional compact top-10 renderer injected by the composition layer (ui keeps no insights import). */
  readonly renderCompact?: (letter: InsightLetterView) => string;
}

/** stdout carries only the letter (contract 1-A); diagnostics go to stderr and never change the exit code.
 * An abort is not a run failure: if the letter survived, it is still printed and exit stays 0. */
export async function runInsightsCommand(parsed: Extract<InsightsParsedArgs, { kind: "insights" }>,
  deps: InsightsCommandDeps, env: CliEnvironment): Promise<number> {
  const controller = new AbortController();
  const unsubscribe = deps.subscribeSignals(() => controller.abort());
  try {
    let view: InsightsRunView;
    try {
      view = await deps.run({ ...(parsed.refresh && { refresh: true }), signal: controller.signal });
    } catch {
      env.stderr("insights: run failed\n");
      return 1;
    }
    if (view.storage === "memory") {
      env.stderr("insights: storage unavailable; history reuse and comparisons are disabled\n");
    }
    if (controller.signal.aborted) env.stderr("insights: cancelled; partial results follow if available\n");
    const compact = view.compact !== undefined ? () => view.compact! : deps.renderCompact;
    const rendered = renderInsights(view.letter, { pretty: Boolean(parsed.pretty), full: Boolean(parsed.full),
      ...(compact && { compact }) });
    if (rendered.stderr) env.stderr(rendered.stderr);
    if (rendered.stdout) env.stdout(rendered.stdout);
    return rendered.exitCode;
  } finally {
    unsubscribe();
  }
}
