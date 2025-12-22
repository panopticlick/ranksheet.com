import { z } from 'zod'

import { env } from '@/lib/env'
import { fetchFromExpressAPI } from '@/lib/http/resilientFetch'

const ExpressBrandSchema = z
  .object({
    name: z.string().nullable().optional(),
  })
  .passthrough()

const ExpressProductSchema = z
  .object({
    asin: z.string().min(1),
    title: z.string().nullable().optional(),
    featuredImage: z.string().nullable().optional(),
    parentAsin: z.string().nullable().optional(),
    variationGroup: z.string().nullable().optional(),
    paapi5Status: z.string().nullable().optional(),
    offersStatus: z.string().nullable().optional(),
    metadata: z.unknown().optional(),
    brand: ExpressBrandSchema.nullable().optional(),
  })
  .passthrough()

export type ExpressProduct = z.infer<typeof ExpressProductSchema>

const ProductsResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    items: z.array(ExpressProductSchema),
  }),
})

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export async function getProductsByAsins(asins: string[]): Promise<Map<string, ExpressProduct>> {
  const unique = Array.from(new Set(asins.map((a) => a.trim()).filter(Boolean)))
  const map = new Map<string, ExpressProduct>()
  if (unique.length === 0) return map

  const apiKey = env.EXPRESS_API_KEY ?? ''
  const headers = { 'x-api-key': apiKey }

  for (const batch of chunk(unique, 50)) {
    const url = `${env.EXPRESS_URL}/products?asins=${encodeURIComponent(batch.join(','))}&limit=${batch.length}`
    const json = await fetchFromExpressAPI<unknown>(url, { headers, method: 'GET' })
    const parsed = ProductsResponseSchema.safeParse(json)
    if (!parsed.success) throw new Error('express_invalid_products_response')
    for (const p of parsed.data.data.items) map.set(p.asin, p)
  }

  return map
}

const Paapi5JobSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  asins: z.array(z.string()).optional(),
})

const Paapi5CreateResponseSchema = z.object({
  status: z.string(),
  data: z.array(Paapi5JobSchema),
})

const Paapi5RunResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    id: z.string().uuid().optional(),
    status: z.string().optional(),
    completedAt: z.string().datetime().nullable().optional(),
    failedAt: z.string().datetime().nullable().optional(),
    message: z.string().nullable().optional(),
  }),
})

async function runWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  const queue = [...items]
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) return
      results.push(await fn(item))
    }
  })
  await Promise.all(workers)
  return results
}

export async function warmPaapi5(asins: string[]): Promise<{ jobIds: string[] }> {
  const unique = Array.from(new Set(asins.map((a) => a.trim()).filter(Boolean)))
  if (unique.length === 0) return { jobIds: [] }

  const apiKey = env.EXPRESS_API_KEY ?? ''
  const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' }

  const created = await fetchFromExpressAPI<unknown>(`${env.EXPRESS_URL}/paapi5`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ asins: unique }),
  })
  const parsedCreated = Paapi5CreateResponseSchema.safeParse(created)
  if (!parsedCreated.success) throw new Error('express_invalid_paapi5_create_response')

  const jobIds = parsedCreated.data.data.map((j) => j.id)

  await runWithConcurrency(jobIds, 3, async (id) => {
    const json = await fetchFromExpressAPI<unknown>(`${env.EXPRESS_URL}/paapi5/${id}`, {
      method: 'PUT',
      headers: { 'x-api-key': apiKey },
    })
    const parsedRun = Paapi5RunResponseSchema.safeParse(json)
    if (!parsedRun.success) throw new Error('express_invalid_paapi5_run_response')
    return parsedRun.data.data
  })

  return { jobIds }
}

