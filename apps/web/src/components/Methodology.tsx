import { Container } from '@/components/Container'

export function Methodology(props: { keyword: string }) {
  return (
    <section id="methodology" className="border-t border-black/5 py-10 dark:border-white/10">
      <Container>
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              How RankSheet Ranks
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Unlike subjective listicles, RankSheet is data-driven. We analyze aggregated Amazon US search-term data for{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">“{props.keyword}”</span> to understand what
              shoppers click and buy.
            </p>
          </div>

          <div className="md:col-span-8">
            <div className="grid gap-3 rounded-2xl border border-black/5 bg-white p-5 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">RankSheet Score</span>: a 1–100 score that
                combines popularity, buyer intent, and trend movement.
              </div>
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Market Share Index</span>: relative click
                intensity within this keyword’s top results (0–100, normalized).
              </div>
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Buyer Trust Index</span>: relative purchase
                signals compared to clicks (0–100, normalized).
              </div>
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Trend</span>: based on rank movement across
                recent periods.
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Note: We never display raw percentage shares. Always confirm real-time offer details (price,
                availability) on Amazon.
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
