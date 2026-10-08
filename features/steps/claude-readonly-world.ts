import type { UsageSource } from "../../src/app/usage-source.js";
import { ClaudeSource } from "../../src/infra/claude-source.js";
import type { HttpClient, HttpRequest } from "../../src/infra/http-client.js";

// 모든 값은 가상 합성값이다. 실제 토큰·계정·사용량 원본을 사용하지 않는다.
export const observedAt = "2026-10-07T00:00:00Z";
export const usageUrl = "https://api.anthropic.com/api/oauth/usage";
const payload = JSON.stringify({
  five_hour: { utilization: 35, resets_at: "2026-10-08T06:00:00Z" },
  seven_day: { utilization: 60, resets_at: "2026-10-10T00:00:00Z" },
});

export const claudeWire = {
  requests: [] as HttpRequest[],
  failStatus: null as number | null,
  failOn: 1,
};

export function resetClaudeWire(): void {
  claudeWire.requests = [];
  claudeWire.failStatus = null;
  claudeWire.failOn = 1;
}

const http: HttpClient = {
  request: async (request) => {
    claudeWire.requests.push(request);
    const failing = claudeWire.failStatus !== null && claudeWire.requests.length === claudeWire.failOn;
    if (failing) return { status: claudeWire.failStatus as number, headers: {}, body: "" };
    return { status: 200, headers: {}, body: payload };
  },
};

// 저장소 대신 config가 선택한 합성 토큰을 공급한다. 빈 값은 실제 source에서 authentication이다.
export function createClaudeSource(token = "fake-claude-token"): UsageSource {
  return new ClaudeSource(http, async () => token, 10000, () => observedAt);
}
