import type { ProviderId, UsageWindow } from "../../domain/usage.js";

type Base = "5h" | "w" | "m";

interface Entry { readonly id: string; readonly base?: Base; readonly qualifier?: string }

const OPENCODE: Readonly<Record<string, Base>> = { rolling: "5h", weekly: "w", monthly: "m" };
const OLLAMA_TARGETS = new Set(["monthly", "credits:included", "credits:purchased"]);

/** 표시할 창만 고른다. ollama-pro는 월간·크레딧 대상만, 하나도 없으면 전체를 유지한다. */
export function displayWindows(provider: ProviderId,
  windows: readonly UsageWindow[]): readonly UsageWindow[] {
  if (provider !== "ollama-pro") return windows;
  const targets = windows.filter((window) => OLLAMA_TARGETS.has(window.id));
  return targets.length > 0 ? targets : windows;
}

function codex(id: string): Entry {
  const match = /^([^:]+):[^:]+:(\d+)m$/.exec(id);
  if (!match) return { id };
  const minutes = Number(match[2]);
  const base = minutes === 300 ? "5h" : minutes === 10_080 ? "w" : undefined;
  return base ? { id, base, qualifier: match[1]! } : { id };
}

function agy(id: string): Entry {
  const match = /^([^:]+):(.+)$/.exec(id);
  if (!match) return { id };
  const slug = match[2]!;
  const base = slug.includes("five-hour") ? "5h" : slug.includes("weekly") ? "w" : undefined;
  return base ? { id, base, qualifier: match[1]! } : { id };
}

function claude(id: string): Entry {
  if (id === "session:5h") return { id, base: "5h" };
  if (id === "weekly:7d") return { id, base: "w" };
  const match = /^weekly:([^:]+):7d$/.exec(id);
  return match ? { id, base: "w", qualifier: match[1]! } : { id };
}

function ollama(id: string): Entry {
  return id === "monthly" || id === "credits:included" ? { id, base: "m" } : { id };
}

function classify(provider: ProviderId, id: string): Entry {
  if (provider === "opencode-go") {
    const base = OPENCODE[id];
    return base ? { id, base } : { id };
  }
  if (provider === "claude") return claude(id);
  if (provider === "codex") return codex(id);
  if (provider === "agy") return agy(id);
  return ollama(id);
}

function firstWord(qualifier: string): string {
  return qualifier.split(/[^a-zA-Z0-9]+/).filter(Boolean)[0] ?? qualifier;
}

function resolve(group: readonly Entry[], base: Base): string[] {
  const initial = group.map((entry) =>
    entry.qualifier ? `${firstWord(entry.qualifier)[0]}-${base}` : base);
  const counts = new Map<string, number>();
  for (const label of initial) counts.set(label, (counts.get(label) ?? 0) + 1);
  const extended = group.map((entry, index) => {
    const label = initial[index]!;
    if ((counts.get(label) ?? 0) > 1 && entry.qualifier) {
      return `${firstWord(entry.qualifier)}-${base}`;
    }
    return label;
  });
  const finalCounts = new Map<string, number>();
  for (const label of extended) finalCounts.set(label, (finalCounts.get(label) ?? 0) + 1);
  return group.map((entry, index) =>
    (finalCounts.get(extended[index]!) ?? 0) > 1 ? entry.id : extended[index]!);
}

/** 창 순서대로 표시 표기를 돌려준다. 판정 불가·중복 해소 불가는 내부 id를 유지한다. */
export function windowLabels(provider: ProviderId,
  windows: readonly UsageWindow[]): string[] {
  const entries = windows.map((window) => classify(provider, window.id));
  const groups = new Map<Base, Entry[]>();
  for (const entry of entries) {
    if (!entry.base) continue;
    const group = groups.get(entry.base) ?? [];
    group.push(entry);
    groups.set(entry.base, group);
  }
  const labels = new Map<string, string>();
  for (const [base, group] of groups) {
    const resolved = group.length > 1 ? resolve(group, base) : [base];
    group.forEach((entry, index) => labels.set(entry.id, resolved[index]!));
  }
  return windows.map((window, index) => labels.get(window.id) ?? entries[index]!.id);
}
