import test from 'node:test';
import assert from 'node:assert/strict';
import { getModels, type AssistantMessage } from '@mariozechner/pi-ai';
import {
  extractJsonObjectFromModelText,
  extractTextFromAssistantMessage,
  resolvePiModelConfig,
  validateBaseUrl,
} from './providerConfig';

test('resolvePiModelConfig defaults to google/gemini-4-hydrogen with google-generative-ai API', () => {
  const cfg = resolvePiModelConfig({ GEMINI_API_KEY: 'test-gemini-key' });
  assert.equal(cfg.model.provider, 'google');
  assert.equal(cfg.model.id, 'gemini-4-hydrogen');
  assert.equal(cfg.model.api, 'google-generative-ai');
  assert.equal(cfg.apiKey, 'test-gemini-key');
  assert.ok(cfg.model.input.includes('image'));
});

test('resolvePiModelConfig looks up built-in @mariozechner/pi-ai catalog models', () => {
  const openaiModels = getModels('openai');
  assert.ok(openaiModels.length > 0);
  const firstVision = openaiModels.find((m) => m.input.includes('image')) || openaiModels[0];

  const cfg = resolvePiModelConfig({
    PI_AI_PROVIDER: 'openai',
    PI_AI_MODEL: firstVision.id,
    PI_AI_API_KEY: 'sk-test-key',
  });
  assert.equal(cfg.isBuiltInCatalog, true);
  assert.equal(cfg.model.provider, 'openai');
  assert.equal(cfg.model.id, firstVision.id);
  assert.equal(cfg.apiKey, 'sk-test-key');
});

test('resolvePiModelConfig supports custom Ollama / DashScope OpenAI-compatible vision models', () => {
  const ollama = resolvePiModelConfig({
    PI_AI_PROVIDER: 'ollama',
    PI_AI_MODEL: 'qwen2.5vl:7b',
    PI_AI_BASE_URL: 'http://127.0.0.1:11434/v1/',
  });
  assert.equal(ollama.isBuiltInCatalog, false);
  assert.equal(ollama.model.api, 'openai-completions');
  assert.equal(ollama.model.baseUrl, 'http://127.0.0.1:11434/v1');
  assert.equal(ollama.model.id, 'qwen2.5vl:7b');
  assert.ok(ollama.model.input.includes('image'));
});

test('validateBaseUrl rejects non-http protocols and malformed URLs', () => {
  assert.throws(() => validateBaseUrl('file:///etc/passwd'));
  assert.throws(() => validateBaseUrl('not-a-valid-url'));
  assert.equal(validateBaseUrl('https://openrouter.ai/api/v1/'), 'https://openrouter.ai/api/v1');
});

test('extractTextFromAssistantMessage extracts text blocks and throws on error stopReason', () => {
  const okMsg: AssistantMessage = {
    role: 'assistant',
    content: [
      { type: 'thinking', thinking: 'internal thoughts' },
      { type: 'text', text: '{"title":"ok"}' },
    ],
    api: 'google-generative-ai',
    provider: 'google',
    model: 'gemini-4-hydrogen',
    usage: {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 15,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp: Date.now(),
  };
  assert.equal(extractTextFromAssistantMessage(okMsg), '{"title":"ok"}');

  const errMsg: AssistantMessage = {
    ...okMsg,
    stopReason: 'error',
    errorMessage: 'upstream failed',
  };
  assert.throws(() => extractTextFromAssistantMessage(errMsg), /upstream failed/);
});

test('extractJsonObjectFromModelText parses raw and markdown-fenced JSON', () => {
  assert.deepEqual(extractJsonObjectFromModelText('{"title":"ok"}'), { title: 'ok' });
  assert.deepEqual(
    extractJsonObjectFromModelText('```json\n{"genre":"人像"}\n```'),
    { genre: '人像' }
  );
});
