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
import { XaiBillingSource } from '../infra/xai-billing-source.js';
import { ClaudeSource } from '../infra/claude-source.js';
import { claudeAuthorization } from '../infra/claude-credentials.js';
import type { HttpClient } from '../infra/http-client.js';
import type { ProcessRunner } from '../infra/process-port.js';

export type SourceFactories = Partial<Record<ProviderId, (settings: ProviderSettings) => UsageSource>>;
export function defaultFactories(ports: { http?: HttpClient; runner?: ProcessRunner; platform?: string } = {}): SourceFactories {
  const runner = ports.runner ?? new NodeProcessRunner();
  const client = ports.http ?? new NodeHttpClient();
  return {
    codex: settings => new CodexSource(runner, settings.executable, settings.timeoutMs),
    agy: settings => new AgySource(runner, settings.executable, settings.timeoutMs),
    xai: settings => new XaiBillingSource(client, undefined, settings.timeoutMs),
    claude: settings => {
      const authorize = claudeAuthorization(ports.platform ? { ...settings, platform: ports.platform } : settings, runner);
      return Object.assign(new ClaudeSource(client, authorize, settings.timeoutMs), { principal: authorize.principal });
    },
    'opencode-go': settings => new OpenCodeGoSource(client, settings.apiKey ?? '', settings.timeoutMs),
    'ollama-pro': settings => new OllamaSource(client,
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
