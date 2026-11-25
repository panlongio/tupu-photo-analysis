import {
  getEnvApiKey,
  getModels,
  getProviders,
  type Api,
  type AssistantMessage,
  type KnownProvider,
  type Model,
} from '@mariozechner/pi-ai';

export interface ResolvedPiModelConfig {
  model: Model<Api>;
  apiKey?: string;
  isBuiltInCatalog: boolean;
}

const VALID_APIS = new Set<string>([
  'openai-completions',
  'openai-responses',
  'azure-openai-responses',
  'openai-codex-responses',
  'anthropic-messages',
  'google-generative-ai',
  'google-vertex',
  'bedrock-converse-stream',
  'mistral-conversations',
]);

export function validateBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('PI_AI_BASE_URL 不是有效的 URL 地址。');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('PI_AI_BASE_URL 仅支持 http:// 或 https:// 协议。');
  }
  return trimmed.replace(/\/+$/, '');
}

function inferApiForProvider(provider: string, explicitApi?: string): Api {
  const cleaned = (explicitApi || '').trim();
  if (cleaned) {
    if (!VALID_APIS.has(cleaned)) {
      throw new Error(`不支持的 PI_AI_API 协议类型：${cleaned}`);
    }
    return cleaned as Api;
  }
  if (provider === 'google') return 'google-generative-ai';
  if (provider === 'google-vertex') return 'google-vertex';
  if (provider === 'anthropic') return 'anthropic-messages';
  if (provider === 'amazon-bedrock') return 'bedrock-converse-stream';
  if (provider === 'azure-openai-responses') return 'azure-openai-responses';
  if (provider === 'mistral') return 'mistral-conversations';
  return 'openai-completions';
}

function isKnownProvider(provider: string): provider is KnownProvider {
  return (getProviders() as string[]).includes(provider);
}

/**
 * Resolves any built-in or custom multimodal vision Model<Api> for @mariozechner/pi-ai
 * strictly from server-side environment variables.
 */
export function resolvePiModelConfig(
  env: Record<string, string | undefined>
): ResolvedPiModelConfig {
  const provider = (env.PI_AI_PROVIDER || 'google').trim().toLowerCase() || 'google';
  const rawBaseUrl = env.PI_AI_BASE_URL || '';
  const baseUrl = validateBaseUrl(rawBaseUrl);

  const defaultModelId =
    provider === 'google'
      ? (env.GEMINI_MODEL || 'gemini-4-hydrogen').trim() || 'gemini-4-hydrogen'
      : '';
  const modelId = (env.PI_AI_MODEL || defaultModelId).trim();

  if (!modelId) {
    throw new Error(`使用 ${provider} 提供方时必须在 .env 中配置 PI_AI_MODEL。`);
  }

  // Resolve API key: explicit PI_AI_API_KEY > provider-native env var via pi-ai's getEnvApiKey
  const explicitKey = (env.PI_AI_API_KEY || '').trim();
  const providerKey =
    provider === 'google'
      ? (env.GEMINI_API_KEY || '').trim()
      : (getEnvApiKey(provider) || '').trim();
  const rawKey = explicitKey || providerKey;
  const apiKey = rawKey === 'MY_GEMINI_API_KEY' ? '' : rawKey;

  // 1. Try Pi AI's built-in model registry first
  if (isKnownProvider(provider)) {
    const catalogModels = getModels(provider);
    const matched = catalogModels.find((m) => m.id === modelId);
    if (matched) {
      const model: Model<Api> = {
        ...matched,
        // Ensure image input is enabled and apply optional custom baseUrl override
        input: matched.input.includes('image') ? matched.input : [...matched.input, 'image'],
        baseUrl: baseUrl || matched.baseUrl,
      };
      return {
        model,
        apiKey: apiKey || undefined,
        isBuiltInCatalog: true,
      };
    }
  }

  // 2. Construct a custom Pi AI Model<Api> (supports gemini-4-hydrogen, Ollama, LM Studio, DashScope, vLLM, etc.)
  const api = inferApiForProvider(provider, env.PI_AI_API);
  if (api === 'openai-completions' && !baseUrl) {
    // Try falling back to a known provider's baseUrl if available in Pi AI's catalog
    const fallbackBase = isKnownProvider(provider)
      ? getModels(provider)[0]?.baseUrl || ''
      : '';
    if (!fallbackBase) {
      throw new Error(
        `自定义模型 ${provider}/${modelId} 需要在 .env 中配置 PI_AI_BASE_URL（例如 http://127.0.0.1:11434/v1）。`
      );
    }
    const customModel: Model<Api> = {
      id: modelId,
      name: modelId,
      api,
      provider,
      baseUrl: fallbackBase,
      reasoning: false,
      input: ['text', 'image'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 8_192,
    };
    return {
      model: customModel,
      apiKey: apiKey || undefined,
      isBuiltInCatalog: false,
    };
  }

  const customModel: Model<Api> = {
    id: modelId,
    name: modelId,
    api,
    provider,
    baseUrl,
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  };

  return {
    model: customModel,
    apiKey: apiKey || undefined,
    isBuiltInCatalog: false,
  };
}

export function extractTextFromAssistantMessage(message: AssistantMessage): string {
  if (message.stopReason === 'error' || message.stopReason === 'aborted') {
    throw new Error(message.errorMessage || '模型请求被中断或返回错误。');
  }
  const textParts = message.content
    .filter((block): block is Extract<AssistantMessage['content'][number], { type: 'text' }> => {
      return block.type === 'text' && typeof block.text === 'string';
    })
    .map((block) => block.text);

  return textParts.join('\n').trim();
}

export function extractJsonObjectFromModelText(rawContent: unknown): unknown {
  let text = '';
  if (typeof rawContent === 'string') {
    text = rawContent.trim();
  } else if (Array.isArray(rawContent)) {
    text = rawContent
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text || '');
        }
        return '';
      })
      .join('\n')
      .trim();
  }

  if (!text) {
    throw new Error('模型未返回任何内容。');
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('模型返回内容不是合法的 JSON 结构。');
  }
}
