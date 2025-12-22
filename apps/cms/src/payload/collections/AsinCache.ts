import type { CollectionConfig } from 'payload'

export const AsinCache: CollectionConfig = {
  slug: 'asin-cache',
  admin: {
    useAsTitle: 'asin',
    defaultColumns: ['asin', 'status', 'title', 'brand', 'fetchedAt', 'expiresAt'],
    group: 'Data',
    description: 'PA-API product data cache to reduce API calls',
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'asin',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Amazon ASIN (unique identifier)',
      },
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'Product title from PA-API',
      },
    },
    {
      name: 'brand',
      type: 'text',
      admin: {
        description: 'Product brand',
      },
    },
    {
      name: 'image',
      type: 'text',
      admin: {
        description: 'Primary product image URL',
      },
    },
    {
      name: 'price',
      type: 'text',
      admin: {
        description: 'Display price (e.g., "$29.99")',
      },
    },
    {
      name: 'paapi5Response',
      type: 'json',
      admin: {
        description: 'Full PA-API5 response for reference',
        condition: () => false, // Hide in admin by default (large payload)
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'VALID',
      options: [
        { label: 'Valid', value: 'VALID' },
        { label: 'Stale', value: 'STALE' },
        { label: 'Error', value: 'ERROR' },
        { label: 'Not Found', value: 'NOT_FOUND' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'fetchedAt',
      type: 'date',
      required: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        date: {
          displayFormat: 'yyyy-MM-dd HH:mm',
        },
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Cache expiration time (for cleanup jobs)',
        date: {
          displayFormat: 'yyyy-MM-dd HH:mm',
        },
      },
    },
    {
      name: 'errorMessage',
      type: 'textarea',
      admin: {
        condition: (data) => data.status === 'ERROR',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (operation === 'create' && !data.fetchedAt) {
          data.fetchedAt = new Date().toISOString()
        }
        // Auto-set expiresAt to 30 days from fetchedAt if not specified
        if (operation === 'create' && !data.expiresAt && data.fetchedAt) {
          const fetchedDate = new Date(data.fetchedAt)
          const expiresDate = new Date(fetchedDate.getTime() + 30 * 24 * 60 * 60 * 1000)
          data.expiresAt = expiresDate.toISOString()
        }
        return data
      },
    ],
  },
}
