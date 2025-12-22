# External API Quick Reference

快速查阅外部 API 集成的关键信息。

## API 凭证

```bash
# SOAX APIs
SOAX_SCRAPING_API_KEY=6ff36d5d-202e-4361-9519-02f3dcdf9e78
SOAX_SERP_API_KEY=PrivateProxies-EXhd6NznWU-lCRYrVpdAG

# Keywords Everywhere
KEYWORDS_EVERYWHERE_API_KEY=b9de90031633c46c1a1b

# LLM API
LLM_API_BASE_URL=https://vectorengine.apifox.cn
LLM_API_KEY=sk-XNyeaj3DgPblcARqjSwsbcJ8DsVkNUrVGznci3sBxAXsKQKJ
LLM_MODEL_ANALYSIS=grok-4.1-thinking
LLM_MODEL_CREATIVE=claude-sonnet-4-5-20250929
```

## 文件位置

| 功能 | 文件路径 |
|------|---------|
| SOAX 客户端 | `/apps/cms/src/lib/external/soaxClient.ts` |
| Keywords Everywhere 客户端 | `/apps/cms/src/lib/external/keywordsEverywhereClient.ts` |
| LLM 客户端 | `/apps/cms/src/lib/external/llmClient.ts` |
| 内容生成服务 | `/apps/cms/src/lib/content/generateKeywordContent.ts` |
| 内容生成 API | `/apps/cms/src/app/(site)/api/admin/generate-content/[slug]/route.ts` |
| Web 组件 | `/apps/web/src/components/RelatedKeywords.tsx` |
| 环境变量示例 | `/apps/cms/.env.example` |

## 快速开始

### 1. 配置环境变量

```bash
cd apps/cms
cp .env.example .env.local
# 编辑 .env.local，添加 API 密钥
```

### 2. 测试配置

```bash
pnpm tsx apps/cms/scripts/test-external-apis.ts
```

### 3. 使用 API

```typescript
// 导入客户端
import {
  searchGoogleShopping,
  getKeywordData,
  generateKeywordContent,
} from '@/lib/external'

// 搜索产品
const products = await searchGoogleShopping('wireless earbuds')

// 获取关键词数据
const kwData = await getKeywordData(['wireless earbuds'])

// 生成内容
const content = await generateKeywordContent('wireless earbuds')
```

## API 端点

### 生成内容

```bash
POST /api/admin/generate-content/{slug}
Header: x-job-token: YOUR_JOB_TOKEN

# 示例
curl -X POST https://cms.ranksheet.com/api/admin/generate-content/wireless-earbuds \
  -H "x-job-token: $JOB_TOKEN"
```

## 常用函数

### SOAX

```typescript
// Google Shopping 搜索
const result = await searchGoogleShopping('keyword', { num: 20 })

// 网页抓取
const result = await fetchWebContent('https://example.com', { markdown: true })
```

### Keywords Everywhere

```typescript
// 基础数据
const result = await getKeywordData(['keyword1', 'keyword2'])

// 相关关键词
const result = await getRelatedKeywords('keyword')

// People Also Search For
const result = await getPasfKeywords('keyword')

// 组合查询
const result = await getCompleteKeywordData('keyword')
```

### LLM

```typescript
// 市场分析（Grok）
const analysis = await generateAnalysis('Analyze this market...')

// 创意内容（Claude）
const content = await generateCreativeContent('Write about...')

// 通用聊天
const response = await chat([
  { role: 'user', content: 'Hello' }
], { model: 'claude-sonnet-4-5-20250929' })

// 结构化输出
const data = await generateStructuredOutput<MyType>(
  'Generate data...',
  { description: '...', example: {...} }
)
```

### 内容生成

```typescript
// 完整内容生成
const content = await generateKeywordContent('wireless earbuds', {
  category: 'Electronics',
  topProducts: [...],
  searchVolume: 50000,
})

// 简化版本（降级）
const content = await generateSimpleContent('wireless earbuds')

// 批量生成
const results = await generateKeywordContentBatch([
  { keyword: 'earbuds' },
  { keyword: 'headphones' },
], { maxConcurrent: 2, delayMs: 2000 })
```

## 速率限制

| API | 延迟 | 配置位置 |
|-----|------|---------|
| SOAX | 1000ms | `soaxClient.ts` |
| Keywords Everywhere | 500ms | `keywordsEverywhereClient.ts` |
| LLM | 无限制 | - |

## 类型定义

### SOAX

- `GoogleShoppingResult` - SERP 结果
- `GoogleShoppingProduct` - 产品数据
- `ScrapingResult` - 抓取结果

### Keywords Everywhere

- `KeywordData` - 关键词数据
- `RelatedKeyword` - 相关关键词
- `PasfKeyword` - PASF 关键词

### LLM

- `ChatMessage` - 聊天消息
- `ChatOptions` - 聊天选项
- `Conversation` - 对话类

### 内容生成

- `KeywordContentContext` - 上下文
- `GeneratedKeywordContent` - 生成的内容

## 错误处理

```typescript
try {
  const content = await generateKeywordContent(keyword)
} catch (error) {
  console.error('Generation failed:', error)
  // 使用降级方案
  const fallback = await generateSimpleContent(keyword)
}
```

## 监控和调试

### 启用详细日志

```bash
LOG_LEVEL=debug pnpm dev
```

### 检查 API 状态

```typescript
import {
  isSoaxConfigured,
  isKeywordsEverywhereConfigured,
  isLlmConfigured,
} from '@/lib/external'

console.log({
  soax: isSoaxConfigured(),
  keywordsEverywhere: isKeywordsEverywhereConfigured(),
  llm: isLlmConfigured(),
})
```

## 常见问题

### API 密钥错误

**症状**: `API_KEY not configured`

**解决**: 检查 `.env.local` 文件

### 速率限制

**症状**: `HTTP 429: Too Many Requests`

**解决**: 使用批量处理函数，增加延迟

### 超时

**症状**: `timeout after 30000ms`

**解决**: 增加 timeout 参数或检查网络

### JSON 解析失败

**症状**: `LLM API returned invalid JSON`

**解决**: 系统会自动使用 fallback 方案

## 完整文档

详细文档请参阅: [EXTERNAL_API_INTEGRATION.md](./EXTERNAL_API_INTEGRATION.md)
