import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type } from '@google/genai';
import {
  complete,
  getProviders,
  type Context,
  type ImageContent,
  type ProviderStreamOptions,
} from '@mariozechner/pi-ai';
import {
  extractJsonObjectFromModelText,
  extractTextFromAssistantMessage,
  resolvePiModelConfig,
} from './src/utils/providerConfig.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const SYSTEM_INSTRUCTION = `你是「UNIVERSAL PHOTO VISUAL ANALYSIS SYSTEM V2.0（全类型照片视觉基因解析 · 智能摄影分析板生成系统）」。
请以专业摄影教材、电影摄影分镜、艺术指导档案和高级视觉研究报告的标准，基于用户上传的参考照片中真实可观察到的视觉证据，输出结构化 JSON 分析数据。

核心原则：
1. 先理解图片，再决定分析什么。严禁套用固定模板或编造画面中不存在的元素。
2. 不可见或无法确定的拍摄参数（如焦距、光圈、快门、器材型号、后期软件）绝对不得伪装成既定事实，必须使用推测性措辞（例如“视觉推测接近中焦段”“景深特征呈现出类似大光圈的虚化效果”）。
3. 避免空洞的赞美性套话（如“绝美”“极具视觉冲击力”），全部落脚于可观察的形体、结构、空间关系、光影逻辑、材质纹理和色彩关系。
4. 坐标规范：所有坐标均采用 0 到 1000 的归一化坐标系（0 表示左/上边缘，1000 表示右/下边缘）。
   - annotations（模块 A，严格 6 条）：自主挑选 6 个最具分析价值的视觉区域（涵盖核心主体、姿态/结构、关键材质、光源/阴影、空间环境等），给出准确的 anchorX、anchorY（落在真实对应物体上）、简短中文标题（4-8字）和一句精准的中文观察说明（18-32字）。尽量将锚点分布在画面左右两侧区域以便外部引线标注，不互相重叠。
   - keywords（模块 B，严格 8 条）：根据照片真实题材动态建立 8 个最核心的视觉生成维度，每条包含 2-5 字中文标签（label）与简短专业描述（description，14-26字）。
   - composition（模块 C）：分析画面空间组织，输出 primaryMethod（构图方式简称）、compositionPoints（构图要点，60-95字）、cameraAndLens（机位与镜头视觉推测，60-95字），以及 2-4 条与真实画面匹配的构图辅助线 guides（仅选择实际适用的辅助线，不可强行叠加无关理论）：
     * rule_of_thirds: coords=[]
     * center_axis: coords=[]
     * leading_line 或 diagonal: coords=[x1, y1, x2, y2]
     * vanishing_point 或 focal_point: coords=[x, y]
     * frame_box: coords=[xmin, ymin, xmax, ymax]
     * curve: coords=[x1, y1, cx, cy, x2, y2]
   - details（模块 D，严格 5 条）：选择 5 个各具多样性且最具放大观察价值的真实局部区域，给出准确裁切框 box=[ymin, xmin, ymax, xmax]（0..1000，宽高建议 180-360 之间，避免 5 张区域重复），并配简短中文标题（4-8字）与一句视觉解释（16-28字）。
   - lighting（模块 E，严格 5 条）：根据实际光源条件（自然光/窗光/逆光/夜景霓虹/闪光等）分析 5 个核心光影与色彩维度，每条包含 2-5 字绿色标签（tag）与清晰说明（description，18-32字）。
   - palette（模块 F，严格 6 条）：提取照片中最具代表性的 6 个实际颜色（主色、辅助色、阴影色、高光/强调色；若是黑白或低饱和作品切勿杜撰鲜艳颜色），提供近似 HEX 色值（#RRGGBB）、雅致准确的中文颜色名称（3-5字）和简短视觉用途说明（8-16字）。
   - prompts（模块 G）：基于全部可观察证据生成中文 Prompt（140-220字）和对应的自然流畅的 English Prompt（90-150 words），最大程度忠实复现原图的主体、姿态、环境、构图、机位透视、光线、色彩与质感，不添加不存在的人物、道具或剧情。`;

const UNIVERSAL_JSON_STRUCTURE_HINT = `
请严格只输出一个合法 JSON 对象（不要包含 Markdown 代码块或任何额外解释文字），键名与类型必须完全符合以下结构：
{
  "title": "string (8-16字档案标题)",
  "genre": "string (2-8字摄影题材)",
  "visualSignature": "string (24-45字核心视觉记忆点)",
  "annotations": [
    { "id": "a1", "title": "string", "observation": "string", "anchorX": 0-1000, "anchorY": 0-1000, "preferredSide": "left" | "right" }
  ],
  "keywords": [
    { "label": "string", "description": "string" }
  ],
  "composition": {
    "primaryMethod": "string",
    "compositionPoints": "string",
    "cameraAndLens": "string",
    "guides": [
      { "kind": "rule_of_thirds" | "center_axis" | "leading_line" | "diagonal" | "vanishing_point" | "frame_box" | "focal_point" | "curve", "label": "string", "coords": [number] }
    ]
  },
  "details": [
    { "id": "d1", "title": "string", "explanation": "string", "box": [ymin, xmin, ymax, xmax] }
  ],
  "lighting": [
    { "tag": "string", "description": "string" }
  ],
  "palette": [
    { "hex": "#RRGGBB", "name": "string", "usage": "string" }
  ],
  "prompts": {
    "chinese": "string",
    "english": "string"
  }
}`;

const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: '简短专业档案标题（8-16字），概括该照片视觉主题' },
    genre: { type: Type.STRING, description: '照片题材与视觉类型（2-8字）' },
    visualSignature: { type: Type.STRING, description: '一句概括核心视觉记忆点（24-45字）' },
    annotations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          observation: { type: Type.STRING },
          anchorX: { type: Type.INTEGER },
          anchorY: { type: Type.INTEGER },
          preferredSide: { type: Type.STRING, enum: ['left', 'right'] },
        },
        required: ['id', 'title', 'observation', 'anchorX', 'anchorY', 'preferredSide'],
      },
    },
    keywords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['label', 'description'],
      },
    },
    composition: {
      type: Type.OBJECT,
      properties: {
        primaryMethod: { type: Type.STRING },
        compositionPoints: { type: Type.STRING },
        cameraAndLens: { type: Type.STRING },
        guides: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              kind: {
                type: Type.STRING,
                enum: [
                  'rule_of_thirds',
                  'center_axis',
                  'leading_line',
                  'diagonal',
                  'vanishing_point',
                  'frame_box',
                  'focal_point',
                  'curve',
                ],
              },
              label: { type: Type.STRING },
              coords: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
            },
            required: ['kind', 'coords'],
          },
        },
      },
      required: ['primaryMethod', 'compositionPoints', 'cameraAndLens', 'guides'],
    },
    details: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          box: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['id', 'title', 'explanation', 'box'],
      },
    },
    lighting: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['tag', 'description'],
      },
    },
    palette: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hex: { type: Type.STRING },
          name: { type: Type.STRING },
          usage: { type: Type.STRING },
        },
        required: ['hex', 'name', 'usage'],
      },
    },
    prompts: {
      type: Type.OBJECT,
      properties: {
        chinese: { type: Type.STRING },
        english: { type: Type.STRING },
      },
      required: ['chinese', 'english'],
    },
  },
  required: [
    'title',
    'genre',
    'visualSignature',
    'annotations',
    'keywords',
    'composition',
    'details',
    'lighting',
    'palette',
    'prompts',
  ],
};

function parseDataUrl(imageDataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(imageDataUrl);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const base64Data = match[2].replace(/\s+/g, '');
  if (!ALLOWED_MIME_TYPES.has(mimeType) || base64Data.length < 32) {
    return null;
  }
  return { mimeType, base64Data };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    try {
      const resolved = resolvePiModelConfig(process.env);
      res.json({
        ok: true,
        engine: '@mariozechner/pi-ai',
        provider: resolved.model.provider,
        model: resolved.model.id,
        api: resolved.model.api,
        builtInProvidersCount: getProviders().length,
      });
    } catch {
      res.json({
        ok: true,
        engine: '@mariozechner/pi-ai',
        provider: (process.env.PI_AI_PROVIDER || 'google').trim(),
        builtInProvidersCount: getProviders().length,
      });
    }
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const body = req.body as {
        imageDataUrl?: string;
        sampledHexColors?: string[];
      };

      if (!body?.imageDataUrl || typeof body.imageDataUrl !== 'string') {
        res.status(400).json({ error: '请先上传有效的图片文件。' });
        return;
      }

      const parsed = parseDataUrl(body.imageDataUrl);
      if (!parsed) {
        res.status(400).json({ error: '图片格式不受支持，请上传 JPG、PNG 或 WebP 图片。' });
        return;
      }

      const { model, apiKey } = resolvePiModelConfig(process.env);

      // Local OpenAI-compatible runtimes (e.g. Ollama / LM Studio) may not require an API key,
      // while Google Gemini requires GEMINI_API_KEY (or PI_AI_API_KEY).
      if (model.provider === 'google' && !apiKey) {
        res.status(503).json({
          error:
            '尚未检测到服务端 GEMINI_API_KEY。在 AI Studio 中请在 Settings > Secrets 中检查；在本地部署时请在 .env 中配置 GEMINI_API_KEY 或切换 PI_AI_PROVIDER 为其他模型。',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const sampledColors = Array.isArray(body.sampledHexColors)
        ? body.sampledHexColors
            .filter((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
            .slice(0, 6)
        : [];

      const colorHint =
        sampledColors.length > 0
          ? `\n补充参考：系统已从原图像素中直接采样到以下 6 个真实代表色（${sampledColors.join(', ')}），在输出 palette 时请优先参考这些真实采样色值，并结合画面识别其准确中文色名与视觉用途；若某色卡需微调更贴合主体，请保持忠实于原图色彩。`
          : '';

      const promptText = `请严格按照 UNIVERSAL PHOTO VISUAL ANALYSIS SYSTEM V2.0 的全部规范，深度解析这张参考照片的视觉基因，输出完整的 7 大模块结构化 JSON。确保所有锚点坐标 (anchorX, anchorY) 和局部细节裁切框 (box: [ymin, xmin, ymax, xmax]) 精确落在照片对应内容上。${colorHint}`;

      const imageContent: ImageContent = {
        type: 'image',
        data: parsed.base64Data,
        mimeType: parsed.mimeType,
      };

      const isGoogleApi = model.api === 'google-generative-ai';
      const context: Context = {
        systemPrompt: isGoogleApi
          ? SYSTEM_INSTRUCTION
          : `${SYSTEM_INSTRUCTION}\n${UNIVERSAL_JSON_STRUCTURE_HINT}`,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              imageContent,
            ],
            timestamp: Date.now(),
          },
        ],
      };

      const options: ProviderStreamOptions = {
        apiKey: apiKey || (model.api === 'openai-completions' ? 'local-no-key' : undefined),
        signal: AbortSignal.timeout(90_000),
        headers: isGoogleApi ? { 'User-Agent': 'aistudio-build' } : undefined,
        onPayload: isGoogleApi
          ? (payload) => {
              const p = payload as { config?: Record<string, unknown> };
              if (p && typeof p === 'object') {
                p.config = {
                  ...(p.config || {}),
                  responseMimeType: 'application/json',
                  responseSchema: GEMINI_RESPONSE_SCHEMA,
                };
              }
              return p;
            }
          : undefined,
      };

      // Unified Pi Agent (@mariozechner/pi-ai) multi-provider vision completion
      const assistantMessage = await complete(model, context, options);
      const rawText = extractTextFromAssistantMessage(assistantMessage);
      const parsedReport = extractJsonObjectFromModelText(rawText);

      res.json({ report: parsedReport });
    } catch (error: unknown) {
      const errObj = error as { status?: number; message?: string };
      const message = errObj?.message || '照片视觉解析失败，请稍后重试。';
      console.error('[/api/analyze] error:', message);

      if (message.includes('API_KEY_INVALID') || errObj?.status === 403) {
        res.status(403).json({
          error: 'API 密钥无效或无权限，请检查服务端环境变量配置。',
        });
        return;
      }
      if (message.includes('RESOURCE_EXHAUSTED') || errObj?.status === 429) {
        res.status(429).json({
          error: '当前请求配额已达上限，请稍后重试或检查密钥配额。',
        });
        return;
      }

      res.status(500).json({ error: `解析过程出现异常：${message}` });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Visual Analysis Server (@mariozechner/pi-ai) listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
