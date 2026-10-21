# 오픈 웨이트 근거 조사 (#253, 2026-10-21)

읽기 전용 조사. 브랜드명이 아닌 공식 모델 카드·HF 저장소·라이선스·공개일로 판정. checkedOn=2026-10-21.

## 판정 표

| 레터 모델 id | 공식 모델/버전 | openWeights | 라이선스 | 공개일 | 근거 URL | 비고 |
|---|---|---|---|---|---|---|
| deepseek-v4-1-flash | DeepSeek-V4.1-Flash (deepseek-ai) | yes | MIT | 2026-09-10 | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash | 가중치 공개. legacy V4 Flash는 V4.1-Flash로 청구 |
| glm-5-3-flash | zai-org/GLM-5.3-Flash | yes | MIT | 2026-08-26 | https://huggingface.co/zai-org/GLM-5.3-Flash | 가중치 공개 |
| glm-5-3 | zai-org/GLM-5.3 | yes | GLM-5.3 License | 2026-08-28 | https://huggingface.co/zai-org/GLM-5.3 | $10B MaaS 보안 심사 조건 |
| mimo-v2-6-pro | XiaomiMiMo/MiMo-V2.6-Pro-RL | yes | MIT | 2026-09-22 | https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL | 가중치 공개 |
| mimo-v2-6-flash | XiaomiMiMo/MiMo-V2.6-Flash-RL | yes | MIT | 2026-09-22 | https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Flash-RL | 가중치 공개 |
| kimi-k3 | moonshotai/Kimi-K3 | yes | Kimi K3 License | 2026-07-27 | https://huggingface.co/moonshotai/Kimi-K3 | $20M MaaS/표시 조건 |
| muse-spark-1-3 | Muse Spark 1.3 (Meta) | yes (사용자 확인) | 미확인(별도 검토) | 2026-10-21 확인 | https://models.dev/labs/meta/ | 사용자 확인(2026-10-21)으로 판정. 공식 페이지와 부분 불일치 가능. Muse Spark Open은 별도 모델 |
| minimax-m3-1-flash | MiniMax M3.1 Flash | yes (사용자 확인) | 미확인(별도 검토) | 2026-10-21 확인 | https://www.minimax.io/blog/minimax-m31f | 사용자 확인(2026-10-21)으로 판정. 공식 페이지와 부분 불일치 가능. MiniMax M3 base는 별개 |
| gemini-3-8-flash | Google Gemini | no | closed | n/a | - | 공개 가중치 없음 |
| gpt-6-* / claude-* / grok-4-7 | OpenAI/Anthropic/xAI | no | closed | n/a | - | 공개 가중치 없음 |

## registry 스키마 제안

```json
{ "modelId": "deepseek-v4-1-flash", "canonicalBase": "deepseek-v4.1-flash", "openWeights": true, "evidenceUrl": "https://...", "checkedOn": "2026-10-21", "license": "MIT", "version": "DeepSeek-V4.1-Flash", "note": "..." }
```

미확인/비공개 모델은 `openWeights:false` 또는 registry 제외. 브랜드 일괄 판정 금지.

## 다음 구현 패킷 초안

- `config/open-weight-models.json`(또는 동등 config)에 검증된 8개만 등록.
- 오픈 웨이트 조합은 registry 조회만 사용. Muse/MiniMax는 사용자 확인(2026-10-21)으로 포함. Gemini/GPT/Claude/Grok 제외.
- Muse Spark Open을 쓰려면 별도 model id `muse-spark-open`으로 등록 후에만 사용.
- 후보 부족 시 Mermaid에 가짜 모델 없이 "조합 구성 불가" 표시.
- 테스트: 브랜드 자동 판정 금지, 미확인 제외, 조합 내 중복 금지.

## 권고

오픈 웨이트 조합: DeepSeek·GLM·MiMo·Kimi·Muse Spark 1.3·MiniMax M3.1 Flash 사용. Gemini·GPT·Claude·Grok 제외. 라이선스 조건(MaaS/표시)은 별도 검토.