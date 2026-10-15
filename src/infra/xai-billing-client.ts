import { SourceError, type UsageSource } from '../app/usage-source.js';
import { createSnapshot, type UsageSnapshot } from '../domain/usage.js';
import type { HttpClient } from './http-client.js';
import { NodeHttpClient } from './http-client.js';
import { parseXaiBilling } from './xai-billing-parser.js';
import { readXaiAuth } from './xai-auth.js';

/** 비문서 엔드포인트(2026-10-15 사용자 채택, w1 실측 HTTP 200·스키마 확정). */
export const XAI_BILLING_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';
export const XAI_BILLING_TIMEOUT_MS = 10000;

/** GET billing → config 주간 percent 창. fetch는 HttpClient로 주입 가능(테스트 합성, 실호출 0). */
export class XaiBillingClient implements UsageSource {
  readonly provider = 'xai' as const;
  constructor(private readonly client: HttpClient = new NodeHttpClient(),
    private readonly auth: () => { token: string } = readXaiAuth,
    private readonly timeoutMs: number = XAI_BILLING_TIMEOUT_MS,
    private readonly now: () => string = () => new Date().toISOString()) {}

  async read(signal?: AbortSignal): Promise<UsageSnapshot> {
    const { token } = this.auth(); // 만료·부재 → SourceError('authentication')
    const response = await this.client.request({
      method: 'GET',
      url: XAI_BILLING_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-XAI-Token-Auth': 'xai-grok-cli',
        'x-grok-client-version': '1.0.0',
        Accept: 'application/json',
      },
      timeoutMs: this.timeoutMs,
    }, signal);
    if (response.status === 401 || response.status === 403) throw new SourceError('authentication');
    if (response.status === 429 || response.status >= 500) throw new SourceError('network');
    if (response.status !== 200) throw new SourceError('unavailable');
    let body: unknown;
    try { body = JSON.parse(response.body); } catch { throw new SourceError('parse'); }
    return createSnapshot('xai', this.now(), parseXaiBilling(body));
  }
}
