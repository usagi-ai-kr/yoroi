import { SourceError, type UsageResult, type UsageSource } from './usage-source.js';

export async function collectOnce(sources: readonly UsageSource[],
  signal?: AbortSignal): Promise<readonly UsageResult[]> {
  return Promise.all(sources.map(async (source): Promise<UsageResult> => {
    try {
      if (signal?.aborted) throw new SourceError('cancelled');
      const snapshot = await source.read(signal);
      if (snapshot.provider !== source.provider) throw new SourceError('parse');
      return { provider: source.provider, snapshot };
    } catch (error) {
      return { provider: source.provider,
        error: error instanceof SourceError ? error : new SourceError('unavailable') };
    }
  }));
}
