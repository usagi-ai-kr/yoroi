// yoroi-managed: opencode-zen-free v1
import { createHooks } from './yoroi/state.js';
import { loadFreeModels, report } from './yoroi/runtime.js';

// Load mark: time only, via the existing report path. Fire-and-forget (report never rejects and has its own timeout),
// so a slow or failing yoroi can never delay or break plugin loading.
export const YoroiZenFreePlugin = async () => {
  void report(['--loaded']);
  return createHooks({ loadFreeModels, report });
};
