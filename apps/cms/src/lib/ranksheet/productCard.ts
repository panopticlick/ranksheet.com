import { z } from 'zod'
import type { ExpressProduct } from '@/lib/amzapi/express'

/**
 * Zod schema for ProductCard validation
 * Used to validate cached product data integrity
 */
export const ProductCardSchema = z.object({
  asin: z.string().min(1),
  title: z.string().nullable(),
  brand: z.string().nullable(),
  image: z.string().nullable(),
  parentAsin: z.string().nullable(),
  variationGroup: z.string().nullable(),
})

export type ProductCard = z.infer<typeof ProductCardSchema>

function getPath(obj: unknown, path: Array<string | number>): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(cur)) return undefined
      cur = cur[key]
      continue
    }

    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function getString(obj: unknown, path: Array<string | number>): string | null {
  const value = getPath(obj, path)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function extractProductCard(product: ExpressProduct): ProductCard {
  const md = product.metadata
  const title =
    (product.title && product.title.trim()) ||
    getString(md, ['ItemInfo', 'Title', 'DisplayValue']) ||
    getString(md, ['ItemInfo', 'Title', 'DisplayValues', 0]) ||
    null

  const brand =
    (product.brand?.name && product.brand.name.trim()) ||
    getString(md, ['ItemInfo', 'ByLineInfo', 'Brand', 'DisplayValue']) ||
    getString(md, ['ItemInfo', 'ByLineInfo', 'Manufacturer', 'DisplayValue']) ||
    null

  const image =
    (product.featuredImage && product.featuredImage.trim()) ||
    getString(md, ['Images', 'Primary', 'Large', 'URL']) ||
    getString(md, ['Images', 'Primary', 'Medium', 'URL']) ||
    getString(md, ['Images', 'Primary', 'Small', 'URL']) ||
    null

  const parentAsin = (product.parentAsin && product.parentAsin.trim()) || null
  const variationGroup = (product.variationGroup && product.variationGroup.trim()) || null

  return {
    asin: product.asin,
    title,
    brand,
    image,
    parentAsin,
    variationGroup,
  }
}
