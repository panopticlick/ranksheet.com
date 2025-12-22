import type { CollectionConfig } from 'payload'

import { slugify } from '@ranksheet/shared'

export const Keywords: CollectionConfig = {
  slug: 'keywords',
  admin: {
    useAsTitle: 'keyword',
    defaultColumns: ['keyword', 'status', 'category', 'isActive', 'indexable'],
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'keyword',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'Custom page H1 (leave empty to use keyword)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Custom meta description',
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
      name: 'marketplace',
      type: 'select',
      defaultValue: 'US',
      options: [
        { label: 'United States', value: 'US' },
        { label: 'United Kingdom', value: 'UK' },
        { label: 'Germany', value: 'DE' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'topN',
      type: 'number',
      defaultValue: 20,
      min: 5,
      max: 50,
      admin: { position: 'sidebar' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'PENDING',
      options: [
        { label: 'Pending', value: 'PENDING' },
        { label: 'Warming Up', value: 'WARMING_UP' },
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Paused', value: 'PAUSED' },
        { label: 'Error', value: 'ERROR' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'statusReason',
      type: 'textarea',
      admin: {
        condition: (data) => data.status === 'ERROR' || data.status === 'WARMING_UP',
      },
    },
    {
      name: 'indexable',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Higher = refresh first',
      },
    },
    {
      name: 'lastRefreshedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'refreshMetadata',
      type: 'json',
      admin: {
        position: 'sidebar',
        description: 'Refresh statistics (lastFetchCount, errorCount, avgDuration, sources)',
        readOnly: true,
      },
    },
    {
      name: 'contentGenerationStatus',
      type: 'select',
      options: [
        { label: 'Not Started', value: 'NOT_STARTED' },
        { label: 'In Progress', value: 'IN_PROGRESS' },
        { label: 'Completed', value: 'COMPLETED' },
        { label: 'Failed', value: 'FAILED' },
      ],
      defaultValue: 'NOT_STARTED',
      admin: { position: 'sidebar' },
    },
    {
      name: 'contentGenerated',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Whether AI-generated content has been created (legacy, use contentGenerationStatus)',
      },
    },
    {
      name: 'contentGeneratedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        condition: (data) => data.contentGenerationStatus === 'COMPLETED',
        description: 'When content was successfully generated',
      },
    },
    {
      name: 'contentGenerationError',
      type: 'textarea',
      admin: {
        position: 'sidebar',
        condition: (data) => data.contentGenerationStatus === 'FAILED',
        description: 'Error message if content generation failed',
      },
    },
    {
      name: 'seoScore',
      type: 'number',
      min: 0,
      max: 100,
      admin: {
        position: 'sidebar',
        description: 'SEO quality score (0-100) for prioritization',
      },
    },
    {
      name: 'qualityScore',
      type: 'number',
      min: 0,
      max: 100,
      admin: {
        position: 'sidebar',
        description: 'Sheet quality score (avg product score + completeness)',
        readOnly: true,
      },
    },
    {
      name: 'generatedTitle',
      type: 'text',
      admin: {
        description: 'AI-generated title (preview before setting as main title)',
      },
    },
    {
      name: 'generatedDescription',
      type: 'textarea',
      admin: {
        description: 'AI-generated description (preview before setting as meta description)',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (operation === 'create' && !data.slug && data.keyword) {
          data.slug = slugify(data.keyword)
        }
        return data
      },
    ],
  },
}

