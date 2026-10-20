/** #195 unit6: 3역할 출력 opt-in 설정. 기본 꺼짐(환경변수 없으면 기존 2역할 출력 그대로). */
export interface LetterThreeRoleConfig {
  readonly enabled: boolean;
  readonly depth?: 7 | 15;
}

export const LETTER_THREE_ROLE_ENV = 'YOROI_LETTER_THREE_ROLE';
export const LETTER_THREE_ROLE_DEPTH_ENV = 'YOROI_LETTER_THREE_ROLE_DEPTH';

/** 설정 로드. 잘못된 값은 조용히 무시하지 않고 오류로 끝낸다(fail-closed, 조작·추정 없음).
 *  리뷰어 가중치는 이 파일이 아니라 `config/reviewer-policy.json`(w2 소유 policy 모듈)이 유일한 원본이다. */
export function letterThreeRoleConfig(env: Readonly<Record<string, string | undefined>>): LetterThreeRoleConfig {
  const mode = (env[LETTER_THREE_ROLE_ENV] ?? 'off').trim().toLowerCase();
  if (mode !== 'on' && mode !== 'off') throw new Error(`Invalid ${LETTER_THREE_ROLE_ENV} value`);
  const depthRaw = env[LETTER_THREE_ROLE_DEPTH_ENV]?.trim();
  let depth: 7 | 15 | undefined;
  if (depthRaw) {
    if (depthRaw !== '7' && depthRaw !== '15') throw new Error(`Invalid ${LETTER_THREE_ROLE_DEPTH_ENV} value`);
    depth = Number(depthRaw) as 7 | 15;
  }
  return { enabled: mode === 'on', ...(depth !== undefined && { depth }) };
}
