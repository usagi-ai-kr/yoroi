import pc from "picocolors";
import type { ProviderId } from "../../domain/usage.js";
import type { UsageStatus } from "./pace.js";

/** 기본 pretty 표는 5개 상태와 xAI weekly n/a를 표시한다. */
const SHOWN_STATUSES: ReadonlySet<UsageStatus> = new Set<UsageStatus>(["limit", "warn", "under", "optimal", "over"]);
let fullModeActive = false;
export const setPrettyFullMode = (enabled: boolean): void => { fullModeActive = enabled; };
export const isPrettyFullMode = (): boolean => fullModeActive;

export const isShownStatus = (status: UsageStatus, full = false,
  provider?: ProviderId, windowId?: string): boolean =>
  full || fullModeActive || SHOWN_STATUSES.has(status) ||
  (status === "n/a" && provider === "xai" && windowId === "weekly");

/** 표에 행이 하나도 남지 않을 때(오류·zen-free 행 포함) 표 대신 내는 한 줄. */
export const EMPTY_PRETTY_LINE = "표시할 항목 없음";

/** 열 폭은 표시 행이 아니라 구조로만 정한다: 생략된 행 수와 무관하게 같고,
 *  Provider 열만 zen-free 행("opencode-zen-free")이 있을 때 20이다. */
export const prettyColWidths = (hasZenFree: boolean): number[] =>
  [hasZenFree ? 20 : 13, 22, 16, 22, 27];

const statusColors: Readonly<Record<UsageStatus, (text: string) => string>> = {
  "optimal": (text) => pc.green(text),
  under: (text) => pc.cyan(text),
  over: (text) => pc.yellow(text),
  warn: (text) => pc.yellowBright(text),
  limit: (text) => pc.red(text),
  "n/a": (text) => text,
};

export function formatStatus(useColor: boolean, status: UsageStatus): string {
  return `ok ${statusColors[status](status)}`;
}
