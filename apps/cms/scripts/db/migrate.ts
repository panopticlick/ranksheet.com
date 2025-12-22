import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'

import { env } from '@/lib/env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

async function main() {
  const ddlPath = path.resolve(dirname, '../../docs/ranksheet-supabase-ddl.sql')
  const sql = await fs.readFile(ddlPath, 'utf8')

  const pool = new Pool({ connectionString: env.DATABASE_URI })
  try {
    await pool.query(sql)
  } finally {
    await pool.end()
  }

  const res = spawnSync('pnpm', ['payload', 'migrate'], {
    stdio: 'inherit',
    env: { ...process.env, PAYLOAD_MIGRATING: 'true' },
  })
  if (res.status !== 0) {
    throw new Error(`Payload migrate failed with exit code ${res.status ?? 'unknown'}`)
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})

