import type { CollectionConfig } from 'payload'

export const RankSheets: CollectionConfig = {
  slug: 'rank-sheets',
  admin: {
    useAsTitle: 'dataPeriod',
    defaultColumns: ['keyword', 'dataPeriod', 'mode', 'validCount', 'readinessLevel'],
    group: 'Data',
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  // NOTE: Database indexes are created in migrations (Payload 3.x doesn't support collection-level indexes)
  // See: src/migrations/20251221_optimization_indexes.ts
  fields: [
    {
      name: 'keyword',
      type: 'relationship',
      relationTo: 'keywords',
      required: true,
      hasMany: false,
    },
    {
      name: 'dataPeriod',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g., 2025-12 or 2025-12-14',
      },
    },
    {
      name: 'reportDate',
      type: 'date',
    },
    {
      name: 'mode',
      type: 'select',
      defaultValue: 'NORMAL',
      options: [
        { label: 'Normal', value: 'NORMAL' },
        { label: 'Low Data', value: 'LOW_DATA' },
      ],
    },
    {
      name: 'validCount',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'readinessLevel',
      type: 'select',
      defaultValue: 'FULL',
      options: [
        { label: 'Full (≥90%)', value: 'FULL' },
        { label: 'Partial (70-90%)', value: 'PARTIAL' },
        { label: 'Low (50-70%)', value: 'LOW' },
        { label: 'Critical (<50%)', value: 'CRITICAL' },
      ],
    },
    {
      name: 'rows',
      type: 'json',
      required: true,
      admin: {
        description: 'Sanitized row data (no raw percentages)',
      },
    },
    {
      name: 'history',
      type: 'json',
      admin: {
        description: 'Previous periods for trend calculation',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional metadata (processing stats, etc.)',
      },
    },
    {
      name: 'topAsins',
      type: 'json',
      admin: {
        description: 'Top 3 ASINs for quick access',
        readOnly: true,
      },
    },
    {
      name: 'processingStats',
      type: 'json',
      admin: {
        description: 'Processing metrics: duration, apiCalls, cacheHits, errors',
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data }) => {
        // Auto-extract top 3 ASINs from rows if not explicitly set
        if (data.rows && Array.isArray(data.rows) && !data.topAsins) {
          data.topAsins = data.rows
            .slice(0, 3)
            .map((row: { asin?: string; rank?: number; title?: string }) => ({
              asin: row.asin,
              rank: row.rank,
              title: row.title,
            }))
        }
        return data
      },
    ],
  },
}
