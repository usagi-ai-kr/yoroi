import type { RuntimeConfig, ProviderSettings } from '../config/load-config.js';
import type { ProviderId } from '../domain/usage.js';
import { SourceError, type UsageSource } from '../app/usage-source.js';
import { CodexSource } from '../infra/codex-source.js';
import { NodeProcessRunner } from '../infra/process-runner.js';
import { NodeHttpClient } from '../infra/http-client.js';
import { OllamaSource } from '../infra/ollama-source.js';
import { fileOllamaAuthorization } from '../infra/ollama-key.js';
import { OpenCodeGoSource } from '../infra/opencode-go-source.js';
import { AgySource } from '../infra/agy-source.js';
import { ClaudeSource } from '../infra/claude-source.js';

export type SourceFactories = Partial<Record<ProviderId, (settings: ProviderSettings) => UsageSource>>;
export function defaultFactories(): SourceFactories {
  return {
    codex: settings => new CodexSource(new NodeProcessRunner(), settings.executable, settings.timeoutMs),
    agy: settings => new AgySource(new NodeProcessRunner(), settings.executable, settings.timeoutMs),
    claude: settings => new ClaudeSource(new NodeProcessRunner(), settings.executable, settings.timeoutMs),
    'opencode-go': settings => new OpenCodeGoSource(new NodeHttpClient(), settings.apiKey ?? '', settings.timeoutMs),
    'ollama-pro': settings => new OllamaSource(new NodeHttpClient(),
      fileOllamaAuthorization(settings.signingKeyPath ?? ''), settings.timeoutMs),
  };
}
export function createSources(config: RuntimeConfig,
  factories: SourceFactories = defaultFactories()): readonly UsageSource[] {
  return config.providers.map(settings => {
    const factory = factories[settings.id];
    if (factory) return factory(settings);
    return { provider: settings.id, read: async () => { throw new SourceError('unavailable'); } };
  });
}
