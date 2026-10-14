import pc from "picocolors";
import type { UsageStatus } from "./pace.js";

/** p83: pretty 표에서 생략하는 상태. 조치가 필요한 under·over·limit만 남긴다. */
const HIDDEN_STATUSES: ReadonlySet<UsageStatus> = new Set<UsageStatus>(["n/a", "optimal"]);
export const isShownStatus = (status: UsageStatus): boolean => !HIDDEN_STATUSES.has(status);

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
  limit: (text) => pc.red(text),
  "n/a": (text) => text,
};

export function formatStatus(useColor: boolean, status: UsageStatus): string {
  return `ok ${statusColors[status](status)}`;
}
