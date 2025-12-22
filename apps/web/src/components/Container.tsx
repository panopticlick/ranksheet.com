import type { ReactNode } from 'react'

import { clsx } from 'clsx'

export function Container(props: { children: ReactNode; className?: string }) {
  return <div className={clsx('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', props.className)}>{props.children}</div>
}

