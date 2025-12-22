import { getPayload } from 'payload'

import configPromise from '@payload-config'

import { slugify } from '@ranksheet/shared'

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[db:seed] ${message}`)
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) {
    throw new Error(`${name} is required`)
  }
  return v.trim()
}

async function main() {
  const isProduction = process.env.NODE_ENV === 'production'
  const allowSeed = process.env.RS_ALLOW_SEED === '1'
  const allowProd = process.env.RS_ALLOW_SEED_PROD === '1'

  if (!allowSeed) {
    throw new Error('Refusing to run seed. Set RS_ALLOW_SEED=1 to proceed.')
  }
  if (isProduction && !allowProd) {
    throw new Error('Refusing to run seed in production. Set RS_ALLOW_SEED_PROD=1 to proceed.')
  }

  const config = await configPromise
  log('Initializing Payload...')
  const payload = await getPayload({ config })
  log('Payload initialized.')

  try {
    const email = requireEnv('RS_SEED_ADMIN_EMAIL')
    const password = requireEnv('RS_SEED_ADMIN_PASSWORD')

    log('Ensuring admin user exists...')
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) {
      await payload.create({
        collection: 'users',
        data: { email, password },
        overrideAccess: true,
      })
    }

    const seedSampleKeywords = process.env.RS_SEED_SAMPLE_KEYWORDS === '1'
    if (!seedSampleKeywords) {
      log('Skipping sample keywords. Set RS_SEED_SAMPLE_KEYWORDS=1 to seed examples.')
      return
    }

    const seedKeywords = [
      { keyword: 'wireless earbuds', category: 'electronics' },
      { keyword: 'noise cancelling earbuds', category: 'electronics' },
      { keyword: 'running headphones', category: 'electronics' },
      { keyword: 'air fryer', category: 'home' },
      { keyword: 'portable blender', category: 'home' },
      { keyword: 'yoga mat', category: 'sports' },
      { keyword: 'protein powder', category: 'health' },
      { keyword: 'toy storage organizer', category: 'toys' },
      { keyword: 'car phone mount', category: 'automotive' },
      { keyword: 'office chair', category: 'office' },
    ] as const

    log(`Seeding ${seedKeywords.length} keywords...`)
    for (const item of seedKeywords) {
      const slug = slugify(item.keyword)
      const found = await payload.find({
        collection: 'keywords',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
      })
      if (found.docs.length > 0) continue
      await payload.create({
        collection: 'keywords',
        overrideAccess: true,
        data: {
          slug,
          keyword: item.keyword,
          category: item.category,
          isActive: true,
          status: 'PENDING',
          indexable: true,
          topN: 20,
          priority: 0,
        },
      })
    }

    log('Done.')
  } finally {
    log('Closing Payload...')
    await payload.db.destroy?.()
    log('Payload closed.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
