import type { UsageSource } from '../app/usage-source.js';
import type { UsageSnapshot } from '../domain/usage.js';
import type { HttpClient } from './http-client.js';
import { NodeHttpClient } from './http-client.js';
import { readXaiAuth } from './xai-auth.js';
import { XaiBillingClient, XAI_BILLING_TIMEOUT_MS } from './xai-billing-client.js';

export { XAI_BILLING_TIMEOUT_MS } from './xai-billing-client.js';

/** xAI Grok CLI billing usage source (#147). */
export class XaiBillingSource implements UsageSource {
  readonly provider = 'xai' as const;
  private readonly delegate: XaiBillingClient;

  constructor(client: HttpClient = new NodeHttpClient(),
    auth: () => { token: string } = readXaiAuth,
    timeoutMs: number = XAI_BILLING_TIMEOUT_MS,
    now: () => string = () => new Date().toISOString()) {
    this.delegate = new XaiBillingClient(client, auth, timeoutMs, now);
  }

  read(signal?: AbortSignal): Promise<UsageSnapshot> {
    return this.delegate.read(signal);
  }
}
