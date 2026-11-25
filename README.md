# 图谱 · 全类型照片视觉基因解析系统

基于 React + Express 与 **Pi Agent 通用模型层（`@mariozechner/pi-ai`）** 的摄影视觉基因分析与 16:9 出版级分析板生成工作台。支持在 AI Studio 中直接运行，也可部署到本地并无缝接入任意视觉大模型。

## 本地部署步骤

需要 **Node.js 22+**。

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量模板并配置你要接入的视觉模型
cp .env.example .env

# 3. 本地开发运行（默认端口 3000）
npm run dev

# 或者构建生产版本并启动
npm run build
NODE_ENV=production npm start
```

启动后在浏览器访问 `http://localhost:3000` 即可使用。

## 基于 `@mariozechner/pi-ai` 接入任意视觉模型

后端通过 Pi Agent 的 `@mariozechner/pi-ai`（统一 `Model` / `Context` / `ImageContent` / `complete()` 接口）调度模型，原生内置 30+ 提供方与标准环境变量自动发现，同时也支持任意自定义 `baseUrl` 与协议。

所有密钥均仅在服务端 `.env` 中读取，不暴露给浏览器。

### 1. Google Gemini（默认）
```env
PI_AI_PROVIDER="google"
PI_AI_MODEL="gemini-4-hydrogen"
GEMINI_API_KEY="你的_GEMINI_API_KEY"
```

### 2. Anthropic Claude（内置提供方）
```env
PI_AI_PROVIDER="anthropic"
PI_AI_MODEL="claude-sonnet-4-5"
ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. OpenAI（内置提供方）
```env
PI_AI_PROVIDER="openai"
PI_AI_MODEL="gpt-4o"
OPENAI_API_KEY="sk-..."
```

### 4. OpenRouter（聚合任意视觉模型）
```env
PI_AI_PROVIDER="openrouter"
PI_AI_MODEL="anthropic/claude-sonnet-4"
OPENROUTER_API_KEY="sk-or-..."
```

### 5. 阿里云百炼 / 通义千问 Qwen-VL（自定义 OpenAI 协议）
```env
PI_AI_PROVIDER="dashscope"
PI_AI_MODEL="qwen-vl-max"
PI_AI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
PI_AI_API="openai-completions"
PI_AI_API_KEY="sk-..."
```

### 6. 本地开源视觉模型（Ollama / LM Studio / vLLM，无需密钥）
```env
PI_AI_PROVIDER="ollama"
PI_AI_MODEL="qwen2.5vl:7b"
PI_AI_BASE_URL="http://127.0.0.1:11434/v1"
PI_AI_API="openai-completions"
PI_AI_API_KEY=""
```
