import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Used for SEO metadataBase + canonical URLs.
  SITE_URL: z.string().url().default('http://localhost:3002'),

  // Public CMS base URL (no trailing slash), e.g. https://cms.ranksheet.com
  CMS_PUBLIC_URL: z.string().url().default('http://localhost:3000'),

  // Not a secret; safe to embed in links.
  AMAZON_ASSOCIATE_TAG: z.string().optional().default(''),
})

export const env = (() => {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const formatted = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${formatted}`)
  }
  return parsed.data
})()
