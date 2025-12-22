'use client'

import { clsx } from 'clsx'
import { useEffect, useState } from 'react'

type RelativeTimeProps = {
  iso?: string | null
  fallback?: string
  className?: string
  title?: string
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return '—'

  const diffMs = Math.max(0, Date.now() - ts)
  const mins = Math.round(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function RelativeTime(props: RelativeTimeProps) {
  const [text, setText] = useState(props.fallback ?? '—')

  useEffect(() => {
    if (!props.iso) return

    const iso = props.iso
    const update = () => setText(formatRelative(iso))
    const initial = window.setTimeout(update, 0)

    const interval = window.setInterval(update, 60_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [props.iso])

  const display = props.iso ? text : (props.fallback ?? '—')

  return (
    <span className={clsx(props.className)} title={props.title}>
      {display}
    </span>
  )
}
