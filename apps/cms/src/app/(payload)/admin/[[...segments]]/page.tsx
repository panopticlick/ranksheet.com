import config from '@payload-config'
import { generatePageMetadata, RootPage } from '@payloadcms/next/views'
import type { Metadata } from 'next'

import { importMap } from '../importMap.js'

export const dynamic = 'force-dynamic'

function compactSearchParams(input: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' || Array.isArray(value)) out[key] = value
  }
  return out
}

export async function generateMetadata(props: {
  params: Promise<{ segments?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const params = await props.params
  const safeParams = { segments: params.segments ?? [] }
  const searchParams = compactSearchParams(await props.searchParams)

  return await generatePageMetadata({
    config,
    params: safeParams,
    searchParams,
  })
}

export default async function PayloadAdminPage(props: {
  params: Promise<{ segments?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await props.params
  const safeParams = { segments: params.segments ?? [] }
  const searchParams = compactSearchParams(await props.searchParams)

  return (
    <RootPage
      config={config}
      importMap={importMap}
      params={safeParams}
      searchParams={searchParams}
    />
  )
}
