// yoroi-managed: opencode-zen-free v1
import { createHooks } from './yoroi/state.js';
import { loadFreeModels, report } from './yoroi/runtime.js';

export const YoroiZenFreePlugin = async () => createHooks({ loadFreeModels, report });
