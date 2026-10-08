import type { UsageWindow } from "../../domain/usage.js";

/** 표시 등급: m → w(접두어 포함) → 5h(접두어 포함) → 등급 없음. */
export type WindowRank = 0 | 1 | 2 | 3;

/** 라벨 끝의 길이 표기로 등급을 정한다. 라벨이 내부 id면 등급을 주지 않는다. */
export function rankOf(label: string): WindowRank {
  const base = label.includes("-") ? label.slice(label.lastIndexOf("-") + 1) : label;
  if (base === "m") return 0;
  if (base === "w") return 1;
  if (base === "5h") return 2;
  return 3;
}

/** 같은 등급은 수집 순서를 유지하는 안정 정렬이다. 비교 결과는 boolean이 아니다. */
export function sortByRank(labels: readonly string[], windows: readonly UsageWindow[]): UsageWindow[] {
  const order = windows.map((window, index) => ({ window, index, rank: rankOf(labels[index]!) }));
  order.sort((left, right) => (left.rank === right.rank ? left.index - right.index : left.rank - right.rank));
  return order.map(entry => entry.window);
}