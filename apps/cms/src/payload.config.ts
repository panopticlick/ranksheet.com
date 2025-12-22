import 'dotenv/config'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'

import { env } from '@/lib/env'

import { AsinCache } from './payload/collections/AsinCache'
import { Keywords } from './payload/collections/Keywords'
import { KeywordRequests } from './payload/collections/KeywordRequests'
import { RankSheets } from './payload/collections/RankSheets'
import { Users } from './payload/collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: env.SITE_URL,
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      afterDashboard: [
        {
          path: '/payload/admin/components/ClickAnalyticsWidget',
          exportName: 'ClickAnalyticsWidget',
        },
      ],
      views: {
        clicks: {
          Component: {
            path: '/payload/admin/views/ClickAnalyticsView',
            exportName: 'ClickAnalyticsView',
          },
          path: '/clicks',
          exact: true,
        },
      },
    },
  },
  collections: [Users, Keywords, RankSheets, KeywordRequests, AsinCache],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    schemaName: 'ranksheet',
    push: false,
    pool: {
      connectionString: env.DATABASE_URI,
    },
  }),
})
