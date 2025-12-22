import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { CommandPalette } from '@/components/CommandPalette'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { WebVitalsReporter } from '@/components/WebVitalsReporter'
import { env } from '@/lib/env'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://ranksheet.com'),
  title: {
    default: 'RankSheet — Data‑Driven Amazon Product Rankings',
    template: '%s — RankSheet',
  },
  description:
    'RankSheet publishes data-driven product rankings based on aggregated Amazon search-term behavior—without exposing raw percentage shares.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'RankSheet — Data‑Driven Amazon Product Rankings',
    description:
      'Data-driven product rankings based on aggregated Amazon search-term behavior—without exposing raw percentage shares.',
    url: '/',
    siteName: 'RankSheet',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout(props: Readonly<{ children: React.ReactNode }>) {
  const siteUrl = env.SITE_URL.replace(/\/$/, '')
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'RankSheet',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
        width: '512',
        height: '512',
      },
      description:
        'Data-driven Amazon product rankings based on aggregated shopper behavior. No raw percentages, only normalized indices.',
      sameAs: [],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        url: `${siteUrl}/contact`,
        availableLanguage: 'en',
      },
      founder: {
        '@type': 'Organization',
        name: 'RankSheet Team',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'RankSheet',
      url: siteUrl,
      description:
        'Data-driven product rankings based on aggregated Amazon search-term behavior—without exposing raw percentage shares.',
      inLanguage: 'en',
      publisher: {
        '@type': 'Organization',
        name: 'RankSheet',
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo.png`,
        },
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ]

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 antialiased dark:bg-black`}>
        <WebVitalsReporter />
        <ErrorBoundary>
          <SiteHeader />
          <main>{props.children}</main>
          <SiteFooter />
          <CommandPalette />
        </ErrorBoundary>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  )
}
