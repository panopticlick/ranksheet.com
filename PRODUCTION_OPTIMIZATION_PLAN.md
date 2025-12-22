# RankSheet.com 生产级优化计划

> **目标**: 将 RankSheet.com 提升至生产级别，确保后端、前端、内容、SEO 各方面都达到企业级标准
> **分析日期**: 2025-12-18
> **分析来源**: 4个专业Agents深度分析 (产品经理、前端架构师、后端架构师、参考项目分析)

---

## 一、现状分析总结

### 1.1 项目评分 (10分制)

| 维度 | 当前评分 | 目标评分 | 差距 |
|------|---------|---------|------|
| **后端数据管道** | 7.3/10 | 9.0/10 | 需修复并发竞态、增加重试机制 |
| **前端代码质量** | 8.5/10 | 9.5/10 | 增强Error Boundary、性能监控 |
| **SEO实现** | 9.5/10 | 10/10 | 完善sitemap、增强内容 |
| **用户体验** | 8.0/10 | 9.0/10 | 微交互、加载优化 |
| **功能完整性** | 7.5/10 | 9.0/10 | 新增外部API集成、内容生成 |

### 1.2 关键发现

**来自产品经理分析:**
- 核心价值: 免费的Amazon排名数据，SEO驱动流量
- 变现: 纯Amazon Associates联盟佣金
- 缺失: 用户账户系统、高级分析功能

**来自前端架构师分析:**
- TypeScript类型系统完善 (Zod Schema 验证)
- ISR + Edge Function策略优秀
- 缺失: Error Boundary、Web Vitals监控

**来自后端架构师分析:**
- 分布式锁机制完善 (PostgreSQL advisory locks)
- 竞态条件风险: `runWithConcurrency` 中的 `queue.shift()`
- 缺失: 重试机制、分布式追踪

**来自参考项目分析 (amz-payload-cms-main):**
- 可复用: Task队列模型、Product缓存模型、多源数据同步
- 推荐迁移: 10个Collections的设计模式

---

## 二、优化方案分工

### Agent 1: 后端数据管道优化 (Backend Pipeline)

**负责范围:**
1. 从 amz-payload-cms-main 迁移增强的 Collections 设计
2. 修复 `refreshAll.ts` 竞态条件
3. 实现弹性重试机制
4. 增强数据库索引

**核心任务:**

```
Task 1.1: Collections 结构增强
├── 新增 AsinCache Collection (产品缓存)
│   ├── asin: string (unique, indexed)
│   ├── paapi5: JSON (完整PA-API响应)
│   ├── title: string
│   ├── image: string
│   ├── brand: string
│   ├── price: string
│   ├── status: enum (VALID|STALE|ERROR)
│   ├── fetchedAt: date
│   └── expiresAt: date
│
├── 增强 Keywords Collection
│   ├── 新增 refreshMetadata: JSON
│   │   └── { lastFetchCount, errorCount, sources[], avgRefreshDuration }
│   ├── 新增 contentGenerated: boolean
│   └── 新增 seoScore: number (0-100)
│
└── 增强 RankSheets Collection
    ├── 新增 topAsins: string[] (快速查询Top3)
    └── 新增 processingStats: JSON

Task 1.2: 修复并发竞态
├── 重写 runWithConcurrency 使用 Semaphore 模式
├── 添加原子任务声明 (双重检查锁定)
└── 实现幂等性保护

Task 1.3: 弹性重试机制
├── 创建 lib/http/withRetry.ts
│   └── 指数退避 + Jitter + 可配置重试次数
├── 外部API调用全部包装
└── 区分可重试/不可重试错误

Task 1.4: 数据库索引优化
├── keywords: (is_active, priority DESC)
├── keywords: (status, category)
├── rank_sheets: (keyword, data_period)
└── asin_cache: (expires_at) 用于清理
```

**输出文件:**
- `/apps/cms/src/payload/collections/AsinCache.ts` (新建)
- `/apps/cms/src/payload/collections/Keywords.ts` (增强)
- `/apps/cms/src/payload/collections/RankSheets.ts` (增强)
- `/apps/cms/src/lib/ranksheet/refreshAll.ts` (重写)
- `/apps/cms/src/lib/http/withRetry.ts` (新建)
- `/apps/cms/src/migrations/202512XX_add_indexes.ts` (新建)

---

### Agent 2: 前端SEO与内容优化 (Frontend & SEO)

**负责范围:**
1. 增强 Structured Data (JSON-LD)
2. 动态内容生成 (利用LLM API)
3. Error Boundary 实现
4. 性能监控集成

**核心任务:**

```
Task 2.1: JSON-LD Schema 增强
├── 添加 Organization Schema 完整信息
├── 添加 WebSite SearchAction Schema
├── 产品页增加 AggregateRating Schema
├── 增加 HowTo Schema (方法论页面)
└── 添加 Article Schema (带 datePublished/dateModified)

Task 2.2: 动态SEO内容生成
├── 创建 lib/content/seoGenerator.ts
│   ├── 使用 LLM API (grok-4.1-thinking for 分析)
│   ├── 使用 claude-sonnet-4-5 for 写作
│   └── 生成: title, description, faq, marketBrief
│
├── 创建 MarketAnalysis 组件
│   ├── 自动分析Top产品特征
│   ├── 生成市场洞察摘要
│   └── 竞争格局说明
│
└── 优化 FAQ 生成
    ├── 动态根据关键词类型调整问题
    ├── 加入 "People Also Ask" 风格问题
    └── 使用 Keywords Everywhere API 获取相关问题

Task 2.3: Error Boundary 实现
├── 创建 components/ErrorBoundary.tsx
├── 包装所有关键页面路由
├── 集成 Sentry 错误上报
└── 优雅降级 UI 设计

Task 2.4: 性能监控
├── 集成 Web Vitals 采集
├── 创建 useWebVitals hook
├── 上报到 Umami 或自定义端点
└── 添加 RUM (Real User Monitoring)
```

**输出文件:**
- `/apps/web/src/lib/content/seoGenerator.ts` (新建)
- `/apps/web/src/lib/content/llmClient.ts` (新建)
- `/apps/web/src/components/ErrorBoundary.tsx` (新建)
- `/apps/web/src/hooks/useWebVitals.ts` (新建)
- `/apps/web/src/app/[slug]/page.tsx` (增强JSON-LD)
- `/apps/cms/src/lib/content/generateKeywordContent.ts` (新建)

---

### Agent 3: 系统集成与功能扩展 (Integration & Features)

**负责范围:**
1. 外部API集成 (SOAX, Keywords Everywhere, LLM)
2. 新功能开发 (相关关键词、SERP分析)
3. 管理后台增强
4. 测试与验证

**核心任务:**

```
Task 3.1: 外部API集成模块
├── 创建 lib/external/soaxClient.ts
│   ├── SERP API 集成 (Google Shopping结果)
│   ├── Web Scraping API 集成
│   └── 速率限制 + 错误处理
│
├── 创建 lib/external/keywordsEverywhereClient.ts
│   ├── Related Keywords API
│   ├── PASF (People Also Search For) API
│   └── 关键词数据获取
│
└── 创建 lib/external/llmClient.ts
    ├── VectorEngine API 集成
    ├── grok-4.1-thinking 模型 (分析)
    ├── claude-sonnet-4-5 模型 (创意写作)
    └── 内容生成任务管理

Task 3.2: 新功能开发
├── 相关关键词推荐
│   ├── 使用 Keywords Everywhere API
│   ├── 显示在 Sheet 页面侧边栏
│   └── 支持用户提交新关键词
│
├── 竞品SERP分析 (可选)
│   ├── 使用 SOAX Google Shopping API
│   ├── 获取相关产品竞争信息
│   └── 展示市场价格区间
│
└── 管理后台增强
    ├── 内容生成触发按钮
    ├── SEO评分仪表板
    └── API调用统计面板

Task 3.3: 集成测试
├── 创建 API 端点测试
├── 创建 数据管道集成测试
├── 验证外部API调用成功率
└── 性能基准测试

Task 3.4: 部署验证
├── 本地完整测试
├── 构建验证 (pnpm build)
├── TypeScript类型检查
└── Lint检查通过
```

**输出文件:**
- `/apps/cms/src/lib/external/soaxClient.ts` (新建)
- `/apps/cms/src/lib/external/keywordsEverywhereClient.ts` (新建)
- `/apps/cms/src/lib/external/llmClient.ts` (新建)
- `/apps/cms/src/app/(site)/api/admin/generate-content/route.ts` (新建)
- `/apps/web/src/components/RelatedKeywords.tsx` (新建)
- `/apps/cms/src/__tests__/integration/` (新建目录)

---

## 三、API凭证汇总

```typescript
// 环境变量配置 (.env.local)

// SOAX APIs
SOAX_SCRAPING_API_KEY=6ff36d5d-202e-4361-9519-02f3dcdf9e78
SOAX_SERP_API_KEY=PrivateProxies-EXhd6NznWU-lCRYrVpdAG

// Keywords Everywhere
KEYWORDS_EVERYWHERE_API_KEY=b9de90031633c46c1a1b

// LLM API (VectorEngine)
LLM_API_BASE_URL=https://vectorengine.apifox.cn
LLM_API_KEY=sk-XNyeaj3DgPblcARqjSwsbcJ8DsVkNUrVGznci3sBxAXsKQKJ
LLM_MODEL_ANALYSIS=grok-4.1-thinking
LLM_MODEL_CREATIVE=claude-sonnet-4-5-20250929
```

---

## 四、执行优先级

### Phase 1: 基础稳定性 (必须)
- [ ] 修复 refreshAll.ts 竞态条件
- [ ] 实现弹性重试机制
- [ ] 添加 Error Boundary
- [ ] 数据库索引优化

### Phase 2: 数据增强 (高优先级)
- [ ] 新增 AsinCache Collection
- [ ] 增强 Keywords/RankSheets Collections
- [ ] 外部API客户端实现
- [ ] 内容生成基础设施

### Phase 3: SEO与内容 (高优先级)
- [ ] JSON-LD Schema 完善
- [ ] 动态SEO内容生成
- [ ] 相关关键词功能
- [ ] FAQ动态生成

### Phase 4: 监控与测试 (中优先级)
- [ ] Web Vitals 监控
- [ ] 集成测试套件
- [ ] Sentry错误追踪
- [ ] 性能基准

---

## 五、验收标准

### 后端
- [ ] 所有API端点响应 < 200ms (P95)
- [ ] 数据刷新无竞态条件
- [ ] 外部API调用成功率 > 95%
- [ ] 错误自动重试覆盖率 100%

### 前端
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Error Boundary 覆盖所有路由

### SEO
- [ ] 所有页面 JSON-LD 验证通过
- [ ] Google Search Console 无错误
- [ ] Sitemap 完整且可访问
- [ ] 每个Sheet页面有唯一Title/Description

### 功能
- [ ] 外部API集成可用
- [ ] 内容生成功能正常
- [ ] 管理后台增强完成
- [ ] 所有测试通过

---

## 六、文件变更清单

### 新建文件 (14个)
```
/apps/cms/src/payload/collections/AsinCache.ts
/apps/cms/src/lib/http/withRetry.ts
/apps/cms/src/lib/external/soaxClient.ts
/apps/cms/src/lib/external/keywordsEverywhereClient.ts
/apps/cms/src/lib/external/llmClient.ts
/apps/cms/src/lib/content/generateKeywordContent.ts
/apps/cms/src/app/(site)/api/admin/generate-content/route.ts
/apps/cms/src/migrations/20251218_add_indexes.ts
/apps/web/src/lib/content/seoGenerator.ts
/apps/web/src/lib/content/llmClient.ts
/apps/web/src/components/ErrorBoundary.tsx
/apps/web/src/components/RelatedKeywords.tsx
/apps/web/src/hooks/useWebVitals.ts
/apps/cms/src/__tests__/integration/refresh.test.ts
```

### 修改文件 (8个)
```
/apps/cms/src/payload.config.ts (添加AsinCache)
/apps/cms/src/payload/collections/Keywords.ts (增强字段)
/apps/cms/src/payload/collections/RankSheets.ts (增强字段)
/apps/cms/src/lib/ranksheet/refreshAll.ts (重写并发)
/apps/cms/src/lib/ranksheet/refreshKeyword.ts (添加重试)
/apps/web/src/app/[slug]/page.tsx (增强JSON-LD)
/apps/web/src/app/layout.tsx (添加ErrorBoundary)
/apps/cms/.env.example (新增环境变量)
```

---

**计划创建完成时间**: 2025-12-18
**预计执行时间**: 并行3个Agents同时工作
**交付物**: 生产级别的完整RankSheet.com应用
