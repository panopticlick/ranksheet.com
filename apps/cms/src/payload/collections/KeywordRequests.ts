import type { CollectionConfig } from 'payload'

import { slugify } from '@ranksheet/shared'

export const KeywordRequests: CollectionConfig = {
  slug: 'keyword-requests',
  admin: {
    useAsTitle: 'keyword',
    defaultColumns: ['keyword', 'votes', 'status', 'category', 'createdAt'],
    group: 'Ops',
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'keyword',
      type: 'text',
      required: true,
      admin: {
        description: 'User-requested keyword (free text).',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Electronics', value: 'electronics' },
        { label: 'Home & Kitchen', value: 'home' },
        { label: 'Sports & Outdoors', value: 'sports' },
        { label: 'Health & Beauty', value: 'health' },
        { label: 'Toys & Games', value: 'toys' },
        { label: 'Automotive', value: 'automotive' },
        { label: 'Office', value: 'office' },
        { label: 'Other', value: 'other' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Optional contact (never shown publicly).',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      admin: {
        description: 'Optional context (use-case, products, constraints).',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'NEW',
      options: [
        { label: 'New', value: 'NEW' },
        { label: 'Reviewed', value: 'REVIEWED' },
        { label: 'Approved', value: 'APPROVED' },
        { label: 'Rejected', value: 'REJECTED' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'votes',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'lastVotedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (operation === 'create') {
          const kw = String(data.keyword ?? '').trim()
          data.keyword = kw
          data.slug = slugify(kw)
        }
        return data
      },
    ],
  },
}

