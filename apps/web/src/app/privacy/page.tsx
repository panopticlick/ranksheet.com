import type { Metadata } from 'next'

import { Container } from '@/components/Container'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'RankSheet privacy policy and data collection practices.',
  alternates: {
    canonical: '/privacy',
  },
}

export default function PrivacyPage() {
  return (
    <Container className="py-16">
      <div className="prose prose-zinc max-w-3xl dark:prose-invert">
        <h1>Privacy Policy</h1>

        <p className="lead">
          RankSheet respects your privacy. This policy explains what information we collect, how we use it, and your
          rights regarding your data.
        </p>

        <h2>Information We Collect</h2>

        <h3>Automatically Collected Information</h3>
        <p>When you visit RankSheet, we may automatically collect:</p>
        <ul>
          <li>
            <strong>Server Logs</strong> — IP address (hashed for privacy), browser type, referring URL, pages visited,
            and timestamps
          </li>
          <li>
            <strong>Cookies</strong> — Small data files stored by your browser (see Cookies section below)
          </li>
        </ul>

        <h3>Information You Provide</h3>
        <p>RankSheet does not require account registration or collect personal information from visitors.</p>

        <h2>How We Use Information</h2>
        <p>We use automatically collected information for:</p>
        <ul>
          <li>
            <strong>Site Operations</strong> — Ensuring site functionality, security, and performance
          </li>
          <li>
            <strong>Analytics</strong> — Understanding how visitors use the site to improve user experience
          </li>
          <li>
            <strong>Abuse Prevention</strong> — Detecting and preventing automated scraping or malicious activity
          </li>
        </ul>

        <h2>Cookies</h2>
        <p>RankSheet may use cookies for:</p>
        <ul>
          <li>
            <strong>Functionality</strong> — Remembering your preferences (e.g., dark mode)
          </li>
          <li>
            <strong>Analytics</strong> — Measuring site traffic and user behavior (if analytics are enabled)
          </li>
        </ul>
        <p>
          You can control cookies through your browser settings. Note that disabling cookies may affect site
          functionality.
        </p>

        <h2>Third-Party Services</h2>

        <h3>Amazon Associates</h3>
        <p>
          When you click affiliate links to Amazon, you are redirected to Amazon.com, which is governed by{' '}
          <a href="https://www.amazon.com/gp/help/customer/display.html?nodeId=468496" target="_blank" rel="noopener">
            Amazon&apos;s Privacy Policy
          </a>
          . RankSheet does not control Amazon&apos;s data practices.
        </p>

        <h3>Cloudflare</h3>
        <p>
          RankSheet is hosted on Cloudflare Pages. Cloudflare may collect data as described in their{' '}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">
            Privacy Policy
          </a>
          .
        </p>

        <h2>Data Retention</h2>
        <p>
          Server logs are retained for up to 90 days for security and operational purposes. After that period, logs are
          automatically deleted.
        </p>

        <h2>Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Request access to your data</li>
          <li>Request deletion of your data</li>
          <li>Opt out of data collection</li>
        </ul>
        <p>
          Since RankSheet does not collect personal information beyond server logs, exercising these rights typically
          involves clearing your browser cookies or using privacy-focused browser settings.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>
          RankSheet is not directed to children under 13 years of age. We do not knowingly collect personal information
          from children.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated
          &quot;Last Updated&quot; date.
        </p>

        <h2>Contact</h2>
        <p>If you have questions about this Privacy Policy, please refer to our site documentation.</p>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Last updated:</strong> December 15, 2025
        </p>
      </div>
    </Container>
  )
}
