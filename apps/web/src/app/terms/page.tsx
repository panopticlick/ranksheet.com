import type { Metadata } from 'next'
import Link from 'next/link'

import { Container } from '@/components/Container'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'RankSheet terms of service and conditions of use.',
  alternates: {
    canonical: '/terms',
  },
}

export default function TermsPage() {
  return (
    <Container className="py-16">
      <div className="prose prose-zinc max-w-3xl dark:prose-invert">
        <h1>Terms of Service</h1>

        <p className="lead">
          By accessing or using RankSheet, you agree to be bound by these Terms of Service. If you do not agree, please
          do not use the site.
        </p>

        <h2>1. Service Description</h2>
        <p>
          RankSheet provides data-driven product rankings based on aggregated Amazon US search-term behavior. Our
          rankings are derived from normalized indices and trends, <strong>not</strong> raw percentage shares from
          proprietary data sources.
        </p>

        <h2>2. No Warranties</h2>
        <p>
          RankSheet is provided &quot;as is&quot; without warranties of any kind, either express or implied, including
          but not limited to:
        </p>
        <ul>
          <li>Accuracy or completeness of rankings</li>
          <li>Availability or uptime of the service</li>
          <li>Product information or specifications shown</li>
        </ul>
        <p>
          Product information displayed on RankSheet is subject to change without notice. We recommend verifying details
          on Amazon before making a purchase.
        </p>

        <h2>3. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, RankSheet and its operators shall not be liable for any damages
          arising from:
        </p>
        <ul>
          <li>Use or inability to use the service</li>
          <li>Reliance on rankings or product information</li>
          <li>Purchases made through affiliate links</li>
          <li>Errors, inaccuracies, or omissions in data</li>
        </ul>

        <h2>4. Affiliate Disclosure</h2>
        <p>
          RankSheet participates in the Amazon Associates Program. We may earn commissions from qualifying purchases
          made through links on this site. See our <Link href="/affiliate-disclosure">Affiliate Disclosure</Link> for
          details.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          All content on RankSheet, including rankings, scores, trends, and site design, is protected by copyright and
          other intellectual property laws. You may not:
        </p>
        <ul>
          <li>Copy, reproduce, or redistribute our rankings or content without permission</li>
          <li>Use automated tools to scrape or harvest data from the site</li>
          <li>Reverse engineer our ranking algorithms or methodologies</li>
        </ul>

        <h2>6. Prohibited Uses</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for any illegal or unauthorized purpose</li>
          <li>Attempt to gain unauthorized access to our systems or data</li>
          <li>Interfere with the proper functioning of the site</li>
          <li>Impersonate RankSheet or misrepresent your affiliation with us</li>
        </ul>

        <h2>7. Third-Party Links</h2>
        <p>
          RankSheet contains links to Amazon.com and other third-party websites. We are not responsible for the content,
          privacy practices, or terms of service of these external sites.
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          <strong>Not Affiliated with Amazon:</strong> RankSheet is not affiliated with, endorsed by, or sponsored by
          Amazon.com, Inc. or its affiliates.
        </p>
        <p>
          <strong>Data Sources:</strong> Rankings are based on aggregated search-term behavior data and may not reflect
          real-time product performance or quality.
        </p>
        <p>
          <strong>No Guarantees:</strong> We make no guarantees about product quality, seller reputation, or customer
          satisfaction.
        </p>

        <h2>9. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms of Service at any time. Changes will be posted on this page with an
          updated &quot;Last Updated&quot; date. Continued use of the site after changes constitutes acceptance of the
          new terms.
        </p>

        <h2>10. Termination</h2>
        <p>
          We reserve the right to terminate or suspend access to the service at any time, without notice, for conduct
          that we believe violates these Terms of Service or is harmful to other users or the service.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms of Service are governed by the laws of the United States. Any disputes shall be resolved in
          accordance with applicable laws.
        </p>

        <h2>12. Contact</h2>
        <p>
          If you have questions about these Terms of Service, please review our <Link href="/#methodology">Methodology</Link>{' '}
          section or other site documentation.
        </p>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Last updated:</strong> December 15, 2025
        </p>
      </div>
    </Container>
  )
}
