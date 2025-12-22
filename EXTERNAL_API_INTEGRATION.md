# External API Integration Guide

本文档说明 RankSheet.com 项目中的外部 API 集成功能。

## 目录

- [概述](#概述)
- [API 客户端](#api-客户端)
- [内容生成服务](#内容生成服务)
- [环境配置](#环境配置)
- [使用示例](#使用示例)
- [故障排除](#故障排除)

## 概述

RankSheet.com 集成了以下外部 API 服务：

| 服务 | 用途 | 位置 |
|------|------|------|
| **SOAX SERP API** | Google Shopping 搜索 | `lib/external/soaxClient.ts` |
| **SOAX Scraping API** | 网页内容抓取 | `lib/external/soaxClient.ts` |
| **Keywords Everywhere** | 关键词数据和相关词 | `lib/external/keywordsEverywhereClient.ts` |
| **LLM API (VectorEngine)** | AI 内容生成 | `lib/external/llmClient.ts` |

## API 客户端

### 1. SOAX 客户端

**文件位置**: `/apps/cms/src/lib/external/soaxClient.ts`

#### 功能

##### Google Shopping 搜索

```typescript
import { searchGoogleShopping } from '@/lib/external/soaxClient'

const result = await searchGoogleShopping('wireless earbuds', {
  location: 'United States',
  num: 20,
  timeout: 30000,
})

console.log(result.shopping_results) // 产品列表
```

##### 网页内容抓取

```typescript
import { fetchWebContent } from '@/lib/external/soaxClient'

const result = await fetchWebContent('https://example.com', {
  country: 'US',
  markdown: true,
  timeout: 30000,
})

console.log(result.content) // HTML 或 Markdown
```

#### 类型定义

- `GoogleShoppingResult` - SERP 搜索结果
- `GoogleShoppingProduct` - 单个产品数据
- `ScrapingResult` - 抓取结果

### 2. Keywords Everywhere 客户端

**文件位置**: `/apps/cms/src/lib/external/keywordsEverywhereClient.ts`

#### 功能

##### 获取关键词数据

```typescript
import { getKeywordData } from '@/lib/external/keywordsEverywhereClient'

const result = await getKeywordData(['wireless earbuds', 'bluetooth headphones'])

result.data?.forEach((kw) => {
  console.log(`${kw.keyword}: ${kw.vol} searches`)
  console.log(`CPC: $${kw.cpc?.value}`)
})
```

##### 获取相关关键词

```typescript
import { getRelatedKeywords } from '@/lib/external/keywordsEverywhereClient'

const result = await getRelatedKeywords('wireless earbuds', {
  country: 'us',
  currency: 'usd',
})

result.data?.forEach((kw) => {
  console.log(`${kw.keyword}: ${kw.vol} searches`)
})
```

##### 获取 People Also Search For (PASF)

```typescript
import { getPasfKeywords } from '@/lib/external/keywordsEverywhereClient'

const result = await getPasfKeywords('wireless earbuds')

result.data?.forEach((kw) => {
  console.log(kw.keyword)
})
```

##### 组合查询

```typescript
import { getCompleteKeywordData } from '@/lib/external/keywordsEverywhereClient'

const result = await getCompleteKeywordData('wireless earbuds')

console.log('Keyword:', result.keyword_data)
console.log('Related:', result.related_keywords)
console.log('PASF:', result.pasf_keywords)
console.log('Credits used:', result.total_credits_used)
```

#### 类型定义

- `KeywordData` - 关键词基础数据
- `RelatedKeyword` - 相关关键词
- `PasfKeyword` - PASF 关键词

### 3. LLM 客户端

**文件位置**: `/apps/cms/src/lib/external/llmClient.ts`

#### 功能

##### 通用聊天接口

```typescript
import { chat } from '@/lib/external/llmClient'

const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain wireless earbuds.' },
]

const response = await chat(messages, {
  model: 'claude-sonnet-4-5-20250929',
  temperature: 0.7,
  maxTokens: 1000,
})

console.log(response)
```

##### 市场分析 (使用 Grok)

```typescript
import { generateAnalysis } from '@/lib/external/llmClient'

const analysis = await generateAnalysis(
  'Analyze the wireless earbuds market based on top selling products.'
)

console.log(analysis)
```

##### 创意内容生成 (使用 Claude)

```typescript
import { generateCreativeContent } from '@/lib/external/llmClient'

const content = await generateCreativeContent(
  'Write an engaging introduction for a wireless earbuds product ranking page.'
)

console.log(content)
```

##### 结构化 JSON 输出

```typescript
import { generateStructuredOutput } from '@/lib/external/llmClient'

interface ProductAnalysis {
  summary: string
  keyFeatures: string[]
  priceRange: { min: number; max: number }
}

const analysis = await generateStructuredOutput<ProductAnalysis>(
  'Analyze these products: ...',
  {
    description: 'Product market analysis',
    example: {
      summary: '...',
      keyFeatures: ['...'],
      priceRange: { min: 0, max: 0 },
    },
  }
)

console.log(analysis.summary)
```

##### 多轮对话

```typescript
import { Conversation } from '@/lib/external/llmClient'

const conv = new Conversation('You are a market analyst.', {
  model: 'analysis', // 使用分析模型
})

const response1 = await conv.send('What are the top wireless earbuds brands?')
const response2 = await conv.send('Which one has the best noise cancellation?')

console.log(conv.getHistory())
```

#### 类型定义

- `ChatMessage` - 聊天消息
- `ChatOptions` - 聊天选项
- `Conversation` - 对话类

## 内容生成服务

**文件位置**: `/apps/cms/src/lib/content/generateKeywordContent.ts`

### 功能

为关键词生成完整的 SEO 优化内容，包括：

- SEO 标题
- Meta 描述
- 市场简报
- FAQ 问答

### 使用示例

```typescript
import { generateKeywordContent } from '@/lib/content/generateKeywordContent'

const content = await generateKeywordContent('wireless earbuds', {
  category: 'Electronics',
  topProducts: [
    {
      title: 'Sony WF-1000XM5',
      brand: 'Sony',
      price: 299.99,
      rating: 4.7,
    },
  ],
  searchVolume: 50000,
  relatedKeywords: ['bluetooth headphones', 'noise cancelling earbuds'],
})

console.log('Title:', content.title)
console.log('Description:', content.description)
console.log('Market Brief:', content.marketBrief)
console.log('FAQ Items:', content.faqItems)
```

### API 端点

**POST** `/api/admin/generate-content/{slug}`

需要 `x-job-token` 认证头。

#### 请求示例

```bash
curl -X POST https://cms.ranksheet.com/api/admin/generate-content/wireless-earbuds \
  -H "x-job-token: YOUR_JOB_TOKEN" \
  -H "Content-Type: application/json"
```

#### 响应示例

```json
{
  "ok": true,
  "slug": "wireless-earbuds",
  "keyword": "wireless earbuds",
  "content": {
    "title": "Best Wireless Earbuds 2025 - Top Rated Products",
    "description": "Discover the best wireless earbuds based on Amazon data...",
    "marketBrief": "The wireless earbuds market has exploded...",
    "faqItems": [
      {
        "question": "What are the best wireless earbuds?",
        "answer": "Based on Amazon sales data..."
      }
    ]
  },
  "usedFallback": false,
  "timestamp": "2025-12-18T12:00:00.000Z"
}
```

### 降级方案

如果 LLM API 调用失败，系统会自动使用模板生成简化版本的内容：

```typescript
import { generateSimpleContent } from '@/lib/content/generateKeywordContent'

const content = await generateSimpleContent('wireless earbuds', {
  category: 'Electronics',
})
```

## 环境配置

### 1. 复制环境变量模板

```bash
cd apps/cms
cp .env.example .env.local
```

### 2. 配置 API 密钥

在 `.env.local` 中填入以下密钥：

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

### 3. 验证配置

```typescript
import {
  isSoaxConfigured,
  isKeywordsEverywhereConfigured,
  isLlmConfigured,
} from '@/lib/external'

console.log('SOAX:', isSoaxConfigured())
console.log('Keywords Everywhere:', isKeywordsEverywhereConfigured())
console.log('LLM:', isLlmConfigured())
```

## 使用示例

### 完整工作流：生成关键词内容

```typescript
import { getCompleteKeywordData } from '@/lib/external/keywordsEverywhereClient'
import { generateKeywordContent } from '@/lib/content/generateKeywordContent'

async function enrichKeyword(keyword: string) {
  // 1. 获取关键词数据
  const kwData = await getCompleteKeywordData(keyword)

  // 2. 生成内容
  const content = await generateKeywordContent(keyword, {
    searchVolume: kwData.keyword_data?.vol,
    relatedKeywords: kwData.related_keywords?.map((k) => k.keyword) || [],
  })

  // 3. 使用内容...
  console.log('Generated content:', content)

  return {
    keywordData: kwData,
    generatedContent: content,
  }
}

await enrichKeyword('wireless earbuds')
```

### 批量处理

```typescript
import { generateKeywordContentBatch } from '@/lib/content/generateKeywordContent'

const keywords = [
  { keyword: 'wireless earbuds' },
  { keyword: 'bluetooth headphones' },
  { keyword: 'noise cancelling earbuds' },
]

const results = await generateKeywordContentBatch(keywords, {
  maxConcurrent: 2, // 并发数
  delayMs: 2000, // 批次间延迟
})

results.forEach((result) => {
  if (result.success) {
    console.log(`✓ ${result.keyword}:`, result.content?.title)
  } else {
    console.log(`✗ ${result.keyword}:`, result.error)
  }
})
```

## Web 组件：RelatedKeywords

**文件位置**: `/apps/web/src/components/RelatedKeywords.tsx`

### 使用示例

```tsx
import { RelatedKeywords } from '@/components/RelatedKeywords'

export default function SheetPage() {
  const relatedItems = [
    {
      keyword: 'bluetooth headphones',
      slug: 'bluetooth-headphones',
      volume: 45000,
      isAvailable: true,
    },
    {
      keyword: 'noise cancelling earbuds',
      slug: undefined, // 还没有 sheet
      volume: 30000,
      isAvailable: false,
    },
  ]

  return (
    <div>
      {/* Your page content */}

      <RelatedKeywords
        keyword="wireless earbuds"
        relatedItems={relatedItems}
        title="Related Product Categories"
        description="Explore similar keywords and discover more market insights."
      />
    </div>
  )
}
```

### Props

| Prop | 类型 | 描述 |
|------|------|------|
| `keyword` | `string` | 当前关键词 |
| `relatedItems` | `RelatedKeywordItem[]` | 相关关键词列表 |
| `title` | `string?` | 自定义标题 |
| `description` | `string?` | 自定义描述 |

### RelatedKeywordItem 类型

```typescript
interface RelatedKeywordItem {
  keyword: string // 关键词
  slug?: string // Sheet slug（如果存在）
  volume?: number // 搜索量
  isAvailable: boolean // 是否有 sheet
}
```

## 故障排除

### 常见问题

#### 1. API 密钥未配置

**错误**: `SOAX_SCRAPING_API_KEY not configured`

**解决**: 检查 `.env.local` 文件，确保配置了所有必需的 API 密钥。

#### 2. 速率限制

**错误**: `HTTP 429: Too Many Requests`

**解决**:
- 增加请求间延迟
- 使用批量处理函数的 `delayMs` 参数
- 检查 API 配额

#### 3. LLM 返回无效 JSON

**错误**: `LLM API returned invalid JSON`

**解决**:
- 降低 temperature（更一致的输出）
- 使用更明确的 prompt
- 检查 schema example 是否正确
- 系统会自动使用 fallback 方案

#### 4. 超时错误

**错误**: `SOAX SERP API timeout after 30000ms`

**解决**:
- 增加 timeout 参数
- 检查网络连接
- 联系 API 服务商

### 调试

启用详细日志：

```bash
LOG_LEVEL=debug pnpm dev
```

检查 API 状态：

```typescript
import {
  isSoaxConfigured,
  isKeywordsEverywhereConfigured,
  isLlmConfigured,
  getAvailableModels,
} from '@/lib/external'

console.log({
  soax: isSoaxConfigured(),
  keywordsEverywhere: isKeywordsEverywhereConfigured(),
  llm: isLlmConfigured(),
  llmModels: getAvailableModels(),
})
```

## 最佳实践

### 1. 错误处理

始终使用 try-catch 处理 API 调用：

```typescript
try {
  const content = await generateKeywordContent(keyword)
  // 使用 content...
} catch (error) {
  console.error('Failed to generate content:', error)
  // 使用降级方案
  const fallback = await generateSimpleContent(keyword)
}
```

### 2. 速率限制

使用内置的速率限制功能：

- SOAX: 1000ms 延迟
- Keywords Everywhere: 500ms 延迟
- 批量处理函数自动处理

### 3. 成本控制

- 缓存 API 结果
- 使用批量接口减少请求
- 监控 API 使用量和成本
- 实现降级方案

### 4. 监控

记录所有 API 调用：

```typescript
import { logger } from '@/lib/logger'

logger.info('API call', {
  service: 'keywords-everywhere',
  endpoint: 'get_keyword_data',
  keywords: keywords.length,
})
```

## 相关文档

- [CLAUDE.md](/CLAUDE.md) - 项目整体文档
- [Payload 配置](./apps/cms/src/payload.config.ts)
- [环境变量示例](./apps/cms/.env.example)

## 支持

如有问题，请检查：
1. 环境变量配置
2. API 密钥有效性
3. 网络连接
4. API 配额和限制
5. 日志输出（`LOG_LEVEL=debug`）
