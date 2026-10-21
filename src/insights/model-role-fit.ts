/** #194: usagi 정성 운용 관찰(역할 적합성) 표기. **점수·순위가 아니다** — 렌더 전용.
 *  출처: usagi-ai-kr/usagi docs/wiki/Model-Operations.md (commit a43d31a, 확인일 2026-10-20). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';
import { normalizeModelName } from './model-id.js';

export const ROLE_FIT_ROLES = ['orchestrator', 'reviewer', 'worker'] as const;
export type RoleFitRole = typeof ROLE_FIT_ROLES[number];

export interface RoleFitEntry { readonly fit: string; readonly note: string }
export interface RoleFitSource {
  readonly repository?: string; readonly path?: string; readonly commit?: string;
  readonly checkedOn?: string; readonly url?: string;
}
export interface ModelRoleFitFile {
  readonly source?: RoleFitSource;
  readonly note?: string;
  readonly models?: Readonly<Record<string, Partial<Record<RoleFitRole, RoleFitEntry>>>>;
}

export const MODEL_ROLE_FIT_PATH = resolve(packageRootFrom(import.meta.url), 'config/model-role-fit.json');

/** 설정 파일을 읽는다. 없으면 undefined(표기 없음) — 실패를Letter 를 막지 않는다. */
export function loadModelRoleFit(path: string = MODEL_ROLE_FIT_PATH): ModelRoleFitFile | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const file = parsed as ModelRoleFitFile;
    return typeof file.models === 'object' && file.models !== null ? file : { ...file, models: {} };
  } catch { return undefined; }
}

/** effort 접미사(-xhigh 등)와 Free 접미사(-free)를 뗀 base id 로 정규화한다(관찰 표는 AA base 단위).
 *  Free 목록 id('deepseek-v4-1-flash-free')도 같은 base 로 매칭돼야 각주가 표시된다(#230). */
const ROLE_FIT_SUFFIX = /-(?:free|minimal|low|medium|high|xhigh|max)$/;
export const roleFitBaseId = (modelId: string): string => {
  let id = modelId;
  // effort 와 Free 접미가 겹친 형태('…-free-high')도 있어 최대 두 번 제거한다.
  for (let i = 0; i < 2 && ROLE_FIT_SUFFIX.test(id); i += 1) id = id.replace(ROLE_FIT_SUFFIX, '');
  return normalizeModelName(id);
};

/** 해당 역할의 정성 노트를 만든다: 'usagi ◎ · 짧은 메모'. 모르는 모델·역할은 undefined. */
export function roleFitNote(modelId: string, role: RoleFitRole, file?: ModelRoleFitFile): string | undefined {
  const source = file ?? loadModelRoleFit();
  const entry = source?.models?.[roleFitBaseId(modelId)]?.[role];
  if (!entry) return undefined;
  const fit = entry.fit?.trim(), note = entry.note?.trim();
  if (!fit && !note) return undefined;
  return `usagi ${fit ?? ''}${note ? ` · ${note}` : ''}`.trim();
}

/** 역할 적합 표식만(◎/○/△/×). 관찰 없음 undefined — 숫자 매핑·점수 환산 없음(표시 전용).
 *  id 정규화는 roleFitNote 와 동일(roleFitBaseId). */
export function roleFitMark(modelId: string, role: RoleFitRole, file?: ModelRoleFitFile): string | undefined {
  const source = file ?? loadModelRoleFit();
  const fit = source?.models?.[roleFitBaseId(modelId)]?.[role]?.fit?.trim();
  return fit ? fit : undefined;
}

/** 범례 문구(점수 아님을 명시). */
export const roleFitLegend = (file?: ModelRoleFitFile): readonly string[] => {
  const source = file ?? loadModelRoleFit();
  const at = source?.source?.checkedOn ?? '2026-10-20';
  return [`usagi = ${at} 정성 운용 관찰(점수 아님)`, ...(source?.source?.url ? [`출처: ${source.source.url}`] : [])];
};
