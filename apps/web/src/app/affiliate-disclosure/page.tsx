import type { Metadata } from 'next'
import Link from 'next/link'

import { Container } from '@/components/Container'

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'RankSheet affiliate disclosure and FTC compliance information.',
  alternates: {
    canonical: '/affiliate-disclosure',
  },
}

export default function AffiliateDisclosurePage() {
  return (
    <Container className="py-16">
      <div className="prose prose-zinc max-w-3xl dark:prose-invert">
        <h1>Affiliate Disclosure</h1>

        <p className="lead">
          RankSheet is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program
          designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com.
        </p>

        <h2>About Amazon Associates</h2>
        <p>
          As an Amazon Associate, we earn from qualifying purchases. This means that when you click on links to Amazon
          products featured on RankSheet and make a purchase, we may receive a small commission at no additional cost
          to you.
        </p>

        <h2>Our Editorial Independence</h2>
        <p>
          While we participate in the Amazon Associates Program, our product rankings are based solely on aggregated
          Amazon search-term behavior data, not on affiliate commission rates or promotional agreements.
        </p>
        <p>We maintain complete editorial independence. Our rankings are determined by:</p>
        <ul>
          <li>
            <strong>Market Share Index</strong> — derived from aggregated shopper click behavior
          </li>
          <li>
            <strong>Buyer Trust Index</strong> — derived from purchase signals relative to clicks
          </li>
          <li>
            <strong>Trend Analysis</strong> — derived from rank movement history
          </li>
        </ul>
        <p>We never manipulate rankings to favor higher-commission products.</p>

        <h2>What We Display</h2>
        <p>
          RankSheet displays normalized indices, scores, and trends — <strong>not</strong> raw percentage shares from
          Amazon Brand Analytics data. This ensures compliance with Amazon&apos;s data usage policies while providing
          valuable insights to shoppers.
        </p>

        <h2>Offer Details</h2>
        <p>
          RankSheet does not display real-time prices or availability. We recommend clicking through to Amazon to verify
          current pricing, stock status, and offer details before making a purchase.
        </p>

        <h2>No Endorsement</h2>
        <p>
          RankSheet is not affiliated with, endorsed by, or sponsored by Amazon.com, Inc. or its affiliates. All
          product names, logos, and brands are property of their respective owners.
        </p>

        <h2>Questions?</h2>
        <p>
          If you have questions about our affiliate relationship or how we rank products, please review our{' '}
          <Link href="/#methodology">Methodology</Link> section.
        </p>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Last updated:</strong> December 15, 2025
        </p>
      </div>
    </Container>
  )
}
