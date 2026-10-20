/** #180/PR#191: 캘리브레이션 자식 환경 builder. 호스트 전체를 넘기지 않는다. */
import { join } from 'node:path';

/** extra에서 허용하는 명시 키. task id만 받는다(인증 키 추측·추가 금지). */
export const CALIBRATION_ENV_EXTRA_KEYS = ['CALIBRATION_TASK_ID'] as const;
/** 호스트에서 선별하는 최소 실행 변수. HOME·XDG·자격 계열은 절대 포함하지 않는다. */
const BASE_ENV_KEYS = ['PATH', 'SYSTEMROOT', 'LANG', 'LC_ALL', 'LC_MESSAGES', 'TZ'] as const;
/** 기존 통제 힌트. 항상 강제되며 extra로 우회할 수 없다. */
const FORCED_ENV: Readonly<Record<string, string>> = {
  GIT_DIR: '/dev/null', GIT_WORK_TREE: '/dev/null', GIT_TERMINAL_PROMPT: '0',
  CALIBRATION_SANDBOX: '1', ALLOW_NETWORKING: '0',
};
/**
 * allowlist만 담은 자식 env를 만든다. 호출자는 envMode:'replace'와 함께 쓴다.
 * homeDir이 없으면 HOME/XDG를 두지 않는다(호스트 값 상속 금지).
 */
export function buildSandboxEnv(
  extra: Readonly<Record<string, string>> = {},
  homeDir?: string,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of BASE_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  if (homeDir !== undefined) {
    env.HOME = homeDir;
    env.XDG_CONFIG_HOME = join(homeDir, '.config');
    env.XDG_DATA_HOME = join(homeDir, '.local', 'share');
    env.XDG_CACHE_HOME = join(homeDir, '.cache');
  }
  for (const key of CALIBRATION_ENV_EXTRA_KEYS) {
    const value = extra[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...FORCED_ENV };
}
