import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SITE_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  PAYLOAD_SECRET: z.string().optional(),

  DATABASE_URI: z.string().optional(),
  REDIS_URL: z.string().optional().default(''),

  FASTAPI_URL: z.string().url().optional(),
  FASTAPI_KEY: z.string().optional(),
  EXPRESS_URL: z.string().url().optional(),
  EXPRESS_API_KEY: z.string().optional(),

  JOB_TOKEN: z.string().optional(),
  ADMIN_IP_WHITELIST: z.string().optional().default(''),

  IP_HASH_SALT: z.string().optional(),

  // External API keys
  KEYWORDS_EVERYWHERE_API_KEY: z.string().optional(),
  SOAX_SCRAPING_API_KEY: z.string().optional(),
  SOAX_SERP_API_KEY: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_API_BASE_URL: z.string().url().optional(),
  LLM_MODEL_ANALYSIS: z.string().optional(),
  LLM_MODEL_CREATIVE: z.string().optional(),
})

function parseSchemaFromDatabaseUri(databaseUri: string): string | null {
  try {
    const url = new URL(databaseUri)
    return url.searchParams.get('schema')
  } catch {
    return null
  }
}

export const env = (() => {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const formatted = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${formatted}`)
  }

  const value = parsed.data
  const isProduction = value.NODE_ENV === 'production'
  const strictEnv = process.env.RS_STRICT_ENV === '1'

  const filled = {
    ...value,
    PAYLOAD_SECRET: value.PAYLOAD_SECRET ?? 'dev_payload_secret_dev_payload_secret_32chars',
    DATABASE_URI:
      value.DATABASE_URI ??
      'postgresql://postgres:postgres@localhost:54321/postgres?schema=ranksheet',
    FASTAPI_URL: value.FASTAPI_URL ?? 'https://fastapi.amzapi.io/api/v2',
    EXPRESS_URL: value.EXPRESS_URL ?? 'https://express.amzapi.io/api/v1',
    JOB_TOKEN: value.JOB_TOKEN ?? 'dev_job_token_please_change',
    IP_HASH_SALT: value.IP_HASH_SALT ?? 'dev_ip_hash_salt_please_change',
  }

  // Strict mode validation for production
  if (isProduction && strictEnv) {
    const required = [
      'PAYLOAD_SECRET',
      'DATABASE_URI',
      'FASTAPI_KEY',
      'EXPRESS_API_KEY',
      'JOB_TOKEN',
      'IP_HASH_SALT',
    ] as const

    // Validate all required secrets are set and not dev values
    for (const key of required) {
      const val = filled[key]
      if (!val || (typeof val === 'string' && val.startsWith('dev_'))) {
        throw new Error(`${key} must be set to a non-dev value in production (RS_STRICT_ENV=1)`)
      }
    }

    // Warn if ADMIN_IP_WHITELIST is not set in production
    if (!filled.ADMIN_IP_WHITELIST) {
      console.warn(
        '[SECURITY WARNING] ADMIN_IP_WHITELIST is not set in production. ' +
        'Admin endpoints will be accessible from any IP with valid token. ' +
        'Set ADMIN_IP_WHITELIST to restrict access.'
      )
    }
  }

  const schemaName = parseSchemaFromDatabaseUri(filled.DATABASE_URI)
  if (schemaName !== 'ranksheet') {
    throw new Error(`DATABASE_URI must include ?schema=ranksheet (got ${schemaName ?? 'none'})`)
  }

  return filled
})()
