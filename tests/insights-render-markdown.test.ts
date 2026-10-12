import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInsights } from '../src/ui/cli/insights-render.js';
import { runInsightsCommand, type InsightsCommandDeps } from '../src/ui/cli/insights-command.js';
import type { InsightLetterView } from '../src/ui/cli/insights-view.js';

const OK: InsightLetterView = {
  ok: true,
  sections: [
    { kind: 'metadata', title: 'AI 인사이트 레터', publicationDate: '2026-10-09', issuedAt: '2026-10-08T15:30:00Z' },
    { kind: 'summary', title: '요약', items: [{ text: '확인된 변화 없음', evidenceIds: [] }] },
  ],
};

test('renderInsights returns markdownText when markdown option is true', () => {
  const mdResult = renderInsights(OK, {
    markdown: true,
    markdownText: () => '# Markdown Title\n\n- item 1',
  });
  assert.equal(mdResult.exitCode, 0);
  assert.equal(mdResult.stdout, '# Markdown Title\n\n- item 1\n');
  assert.equal(mdResult.stderr, '');
});

test('runInsightsCommand passes markdown option and prints markdown text', async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const env = { stdout: (t: string) => stdout.push(t), stderr: (t: string) => stderr.push(t) };
  const deps: InsightsCommandDeps = {
    run: async () => ({
      letter: OK,
      storage: 'sqlite',
      markdown: '# Rendered Markdown Top 10',
    }),
    subscribeSignals: () => () => {},
  };
  const code = await runInsightsCommand(
    { kind: 'insights', operation: 'once', markdown: true },
    deps,
    env,
  );
  assert.equal(code, 0);
  assert.equal(stdout.join(''), '# Rendered Markdown Top 10\n');
  assert.equal(stderr.join(''), '');
});

test('--markdown without an injected renderer fails loudly instead of falling back', async () => {
  const rendered = renderInsights(OK, { markdown: true });
  assert.equal(rendered.exitCode, 1);
  assert.equal(rendered.stdout, '');
  assert.match(rendered.stderr, /markdown/i);

  const stdout: string[] = [];
  const stderr: string[] = [];
  const env = { stdout: (t: string) => stdout.push(t), stderr: (t: string) => stderr.push(t) };
  const deps: InsightsCommandDeps = {
    run: async () => ({ letter: OK, storage: 'sqlite', compact: '[compact fallback]' }),
    subscribeSignals: () => () => {},
  };
  const code = await runInsightsCommand(
    { kind: 'insights', operation: 'once', markdown: true },
    deps,
    env,
  );
  assert.equal(code, 1);
  assert.equal(stdout.join(''), '');
  assert.match(stderr.join(''), /markdown/i);
});
