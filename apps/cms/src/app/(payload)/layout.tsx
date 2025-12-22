import { RootLayout as PayloadRootLayout } from '@payloadcms/next/layouts'
import configPromise from '@payload-config'

import { importMap } from './admin/importMap.js'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return await PayloadRootLayout({ children, config: configPromise, importMap })
}
