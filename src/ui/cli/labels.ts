import type { ProviderId, UsageWindow } from "../../domain/usage.js";
import { sortByRank } from "./order.js";

type Base = "5h" | "w" | "m";

interface Entry { readonly id: string; readonly base?: Base; readonly stages?: readonly string[] }

const OPENCODE: Readonly<Record<string, Base>> = { rolling: "5h", weekly: "w", monthly: "m" };
const OLLAMA_TARGETS = new Set(["monthly", "credits:included"]);

/** 표시할 창만 골라 m→w→5h→등급 없음 순으로 안정 정렬한다. ollama-pro는 월간 대상만, 없으면 빈 목록. */
export function displayWindows(provider: ProviderId,
  windows: readonly UsageWindow[]): readonly UsageWindow[] {
  const visible = provider === "ollama-pro"
    ? windows.filter((window) => OLLAMA_TARGETS.has(window.id)) : [...windows];
  return sortByRank(windowLabels(provider, visible), visible);
}

function word(text: string): string {
  return text.split(/[^a-zA-Z0-9]+/).filter(Boolean)[0] ?? text;
}

/** codex: kind 접두어 → 버킷+kind 접두어. 예 p-5h, cp-5h. */
function codex(id: string): Entry {
  const match = /^([^:]+):([^:]+):(\d+)m$/.exec(id);
  if (!match) return { id };
  const minutes = Number(match[3]);
  const base = minutes === 300 ? "5h" : minutes === 10_080 ? "w" : undefined;
  if (!base) return { id };
  const bucket = word(match[1]!);
  const kind = word(match[2]!).toLowerCase();
  return { id, base, stages: [kind[0]!, `${bucket[0]!}${kind[0]!}`] };
}

function agy(id: string): Entry {
  const match = /^([^:]+):(.+)$/.exec(id);
  if (!match) return { id };
  const slug = match[2]!;
  const base = slug.includes("five-hour") ? "5h" : slug.includes("weekly") ? "w" : undefined;
  return base ? { id, base, stages: [word(match[1]!)[0]!, word(match[1]!)] } : { id };
}

function claude(id: string): Entry {
  if (id === "session:5h") return { id, base: "5h" };
  if (id === "weekly:7d") return { id, base: "w" };
  const match = /^weekly:([^:]+):7d$/.exec(id);
  return match ? { id, base: "w", stages: [word(match[1]!)[0]!] } : { id };
}

function ollama(id: string): Entry {
  return id === "monthly" || id === "credits:included" ? { id, base: "m" } : { id };
}

function classify(provider: ProviderId, id: string): Entry {
  if (provider === "claude") return claude(id);
  if (provider === "codex") return codex(id);
  if (provider === "agy") return agy(id);
  if (provider === "opencode-go") return OPENCODE[id] ? { id, base: OPENCODE[id] } : { id };
  if (provider === "xai" && id === "weekly") return { id, base: "w" };
  return ollama(id);
}

function countsOf(labels: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return counts;
}

/** 같은 base가 겹칠 때 단계별 접두어를 적용하고, 해소되지 않으면 내부 id를 유지한다. */
function labelsFor(group: readonly Entry[], base: Base): string[] {
  let labels = group.map((entry) => entry.stages?.[0] ? `${entry.stages[0]}-${base}` : base);
  for (let stage = 1; stage <= 2; stage += 1) {
    const counts = countsOf(labels);
    if (counts.size === labels.length) return labels;
    labels = group.map((entry, index) => {
      const label = labels[index]!;
      if (counts.get(label) === 1) return label;
      const qualifier = entry.stages?.[stage];
      return qualifier ? `${qualifier}-${base}` : label;
    });
  }
  const counts = countsOf(labels);
  return group.map((entry, index) =>
    (counts.get(labels[index]!) ?? 0) > 1 ? entry.id : labels[index]!);
}

/** 창 순서대로 표시 표기를 돌려준다. 판정 불가·중복 해소 불가는 내부 id를 유지한다. */
export function windowLabels(provider: ProviderId, windows: readonly UsageWindow[]): string[] {
  const entries = windows.map((window) => classify(provider, window.id));
  const groups = new Map<Base, Entry[]>();
  for (const entry of entries) if (entry.base) groups.set(entry.base, [...(groups.get(entry.base) ?? []), entry]);
  const labels = new Map<string, string>();
  const multi = provider === "agy" && new Set(entries.filter((e) => e.base).map((e) => e.id.split(":")[0]!)).size > 1;
  for (const [base, group] of groups) {
    const resolved = group.length > 1 || multi ? labelsFor(group, base) : [base];
    group.forEach((entry, index) => labels.set(entry.id, resolved[index]!));
  }
  return windows.map((window, index) => labels.get(window.id) ?? entries[index]!.id);
}
