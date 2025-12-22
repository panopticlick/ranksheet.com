/**
 * POST /api/admin/generate-content/{slug}
 * 为指定的关键词生成 SEO 内容
 * 需要 x-job-token 认证
 */

import { NextResponse } from 'next/server'

import { requireJobAuth } from '@/lib/auth/jobToken'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { withIdempotency } from '@/lib/security/idempotency'
import {
  generateKeywordContent,
  generateSimpleContent,
  type KeywordContentContext,
} from '@/lib/content/generateKeywordContent'
import { logger } from '@/lib/logger'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  // 认证检查
  const unauthorized = requireJobAuth(request)
  if (unauthorized) return unauthorized

  // 速率限制
  const limited = await enforceRateLimit(request, {
    name: 'admin_generate_content',
    limit: 10,
    windowSeconds: 60,
  })
  if (limited) return limited

  return await withIdempotency(request, async () => {
    const params = await context.params
    const slug = params.slug.trim()

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: 'invalid_slug' },
        { status: 400 }
      )
    }

    logger.info('Generating content for keyword', { slug })

    try {
      const payload = await getPayload({ config: configPromise })

      // 1. 获取关键词记录
      const keywordResults = await payload.find({
        collection: 'keywords',
        where: {
          slug: { equals: slug },
        },
        limit: 1,
      })

      if (keywordResults.docs.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'keyword_not_found' },
          { status: 404 }
        )
      }

      const keywordDoc = keywordResults.docs[0]
      const keyword = keywordDoc.keyword

      // 2. 获取最新的排名数据（用于上下文）
      const sheetResults = await payload.find({
        collection: 'rank-sheets',
        where: {
          keywordSlug: { equals: slug },
        },
        sort: '-createdAt',
        limit: 1,
      })

      // 3. 构建上下文
      const context: KeywordContentContext = {
        category: keywordDoc.category ?? undefined,
      }

      // 从最新的排名表中获取产品数据
      if (sheetResults.docs.length > 0) {
        const sheet = sheetResults.docs[0]
        const rows = (Array.isArray(sheet.rows) ? sheet.rows : []) as Array<{
          productTitle?: string
          brand?: string
          price?: number
          rating?: number
        }>

        context.topProducts = rows.slice(0, 10).map((row) => ({
          title: row.productTitle || '',
          brand: row.brand || undefined,
          price: row.price || undefined,
          rating: row.rating || undefined,
        }))
      }

      // 4. 生成内容
      let generatedContent
      let usedFallback = false

      try {
        generatedContent = await generateKeywordContent(keyword, context)
      } catch (error) {
        logger.warn('LLM generation failed, using simple fallback', {
          slug,
          error: error instanceof Error ? error.message : String(error),
        })
        generatedContent = await generateSimpleContent(keyword, context)
        usedFallback = true
      }

      // 5. 更新关键词记录
      await payload.update({
        collection: 'keywords',
        id: keywordDoc.id,
        data: {
          generatedTitle: generatedContent.title,
          generatedDescription: generatedContent.description,
          contentGenerated: true,
        },
      })

      logger.info('Content generated and saved successfully', {
        slug,
        usedFallback,
      })

      return NextResponse.json({
        ok: true,
        slug,
        keyword,
        content: generatedContent,
        usedFallback,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Failed to generate content', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      })

      return NextResponse.json(
        {
          ok: false,
          error: 'generation_failed',
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      )
    }
  })
}
