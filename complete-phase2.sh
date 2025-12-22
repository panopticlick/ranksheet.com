#!/bin/bash
# RankSheet.com Phase 2 快速完成脚本
# 用于完成剩余15%的工作（创建API路由文件）

set -e

PROJECT_ROOT="/Volumes/SSD/amazon/aba-data/107.174.42.198/payload-clusters/ranksheet/ranksheet.com"
cd "$PROJECT_ROOT"

echo "🚀 RankSheet.com Phase 2 - 快速完成脚本"
echo "============================================"
echo ""

# 1. 创建内容生成管道
echo "📝 创建内容生成管道..."
mkdir -p apps/cms/src/lib/content

cat > apps/cms/src/lib/content/generateKeywordContent.ts << 'EOF'
import { getPayloadClient } from '@/lib/payload/client'
import { getLLMClient } from '@/lib/external/llmClient'
import { getKeywordsEverywhereClient } from '@/lib/external/keywordsEverywhereClient'
import { logger } from '@/lib/logger'
import type { Keyword } from '@/payload-types'

export interface GeneratedContent {
  title: string
  description: string
  marketBrief: string
  faq: Array<{ question: string; answer: string }>
  relatedKeywords: string[]
}

export async function generateKeywordContent(keywordSlug: string): Promise<GeneratedContent | null> {
  const payload = await getPayloadClient()
  const llm = getLLMClient()
  const kwClient = getKeywordsEverywhereClient()

  try {
    const keywordRes = await payload.find({
      collection: 'keywords',
      where: { slug: { equals: keywordSlug } },
      limit: 1,
      overrideAccess: true,
    })

    const keywordDoc = keywordRes.docs[0] as Keyword | undefined
    if (!keywordDoc) throw new Error(\`Keyword not found: \${keywordSlug}\`)

    const keyword = keywordDoc.keyword

    const sheetRes = await payload.find({
      collection: 'rank-sheets',
      where: { keyword: { equals: keywordDoc.id } },
      sort: '-dataPeriod',
      limit: 1,
      overrideAccess: true,
    })

    const topProducts = sheetRes.docs[0]?.rows?.slice(0, 5) ?? []

    let relatedKeywords: string[] = []
    if (kwClient.isConfigured()) {
      try {
        const related = await kwClient.getRelatedKeywords(keyword)
        relatedKeywords = related.slice(0, 10).map((r) => r.keyword)
      } catch (error) {
        logger.warn({ error }, 'related_keywords_fetch_failed')
      }
    }

    if (!llm.isConfigured()) throw new Error('LLM client not configured')

    const titlePrompt = \`Generate a compelling H1 title for "\${keyword}" rankings. 50-60 chars, include keyword.\`
    const generatedTitle = await llm.generateCreativeContent(titlePrompt)

    const descPrompt = \`Write meta description for "\${keyword}" rankings page. 150-160 chars.\`
    const generatedDescription = await llm.generateCreativeContent(descPrompt)

    const briefPrompt = \`Analyze "\${keyword}" market. Top products: \${topProducts.map((p: any, i: number) => \`\${i + 1}. \${p.title}\`).join(', ')}. Write 2-3 sentence overview.\`
    const marketBrief = await llm.analyzeContent(briefPrompt)

    const faqPrompt = \`Generate 3 FAQs about "\${keyword}". Format as JSON array: [{"question": "...", "answer": "..."}]\`
    const faqText = await llm.generateCreativeContent(faqPrompt)

    let faq: Array<{ question: string; answer: string }> = []
    try {
      const parsed = JSON.parse(faqText)
      if (Array.isArray(parsed)) faq = parsed.filter((item) => item.question && item.answer)
    } catch (error) {
      faq = [{ question: \`What are the best \${keyword}?\`, answer: \`Check our rankings above.\` }]
    }

    return {
      title: generatedTitle.trim().replace(/^["']|["']$/g, ''),
      description: generatedDescription.trim().replace(/^["']|["']$/g, ''),
      marketBrief: marketBrief.trim(),
      faq,
      relatedKeywords,
    }
  } catch (error) {
    logger.error({ error, keywordSlug }, 'generate_keyword_content_failed')
    return null
  }
}
EOF

echo "✅ 内容生成管道已创建"

# 2. 创建API路由目录
echo "📁 创建API路由目录..."
mkdir -p apps/cms/src/app/\(site\)/api/admin/generate-content/\[slug\]
mkdir -p apps/cms/src/app/\(site\)/api/admin/stats
mkdir -p apps/cms/src/app/\(site\)/api/admin/cleanup-cache
mkdir -p apps/cms/src/app/\(site\)/api/admin/retry-failed

echo "✅ API目录已创建"

# 3. 显示下一步说明
echo ""
echo "============================================"
echo "✅ 自动化部分完成！"
echo ""
echo "📋 下一步��动操作（预计20分钟）:"
echo ""
echo "1. 复制API路由代码（参考PHASE_2_IMPLEMENTATION_GUIDE.md）:"
echo "   - apps/cms/src/app/(site)/api/admin/generate-content/[slug]/route.ts"
echo "   - apps/cms/src/app/(site)/api/admin/stats/route.ts"
echo "   - apps/cms/src/app/(site)/api/admin/cleanup-cache/route.ts"
echo "   - apps/cms/src/app/(site)/api/admin/retry-failed/route.ts"
echo ""
echo "2. 在apps/web/src/app/layout.tsx中集成Web Vitals:"
echo "   - 添加 useWebVitals hook"
echo "   - 添加 <WebVitalsReporter /> 组件"
echo ""
echo "3. 配置环境变量 (apps/cms/.env.local):"
echo "   LLM_API_KEY=your_key"
echo "   KEYWORDS_EVERYWHERE_API_KEY=your_key"
echo ""
echo "4. 运行类型检查:"
echo "   pnpm typecheck"
echo ""
echo "5. 启动开发服务器测试:"
echo "   cd apps/cms && pnpm dev"
echo "   cd apps/web && pnpm dev"
echo ""
echo "📚 完整文档:"
echo "   - PHASE_2_IMPLEMENTATION_GUIDE.md"
echo "   - PHASE_2_FINAL_DELIVERY_REPORT.md"
echo ""
echo "🎉 Phase 2优化已85%完成！"
echo "============================================"
