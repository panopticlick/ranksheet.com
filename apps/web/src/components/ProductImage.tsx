'use client'

import Image, { type ImageProps } from 'next/image'
import { clsx } from 'clsx'
import { useMemo, useState } from 'react'

import type { CategoryKey } from '@/lib/ranksheet/categories'

type ProductImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null
  alt: string
  categoryKey?: CategoryKey | null
  fallbackClassName?: string
}

function CategoryPlaceholder(props: { categoryKey: CategoryKey; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: clsx('h-full w-full', props.className),
  }

  switch (props.categoryKey) {
    case 'electronics':
      return (
        <svg {...common}>
          <path d="M4 13a8 8 0 0 1 16 0" />
          <path d="M4 13v5a2 2 0 0 0 2 2h1v-8H6a2 2 0 0 0-2 2Z" />
          <path d="M20 13v5a2 2 0 0 1-2 2h-1v-8h1a2 2 0 0 1 2 2Z" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10.5V21h14V10.5" />
          <path d="M9 21v-6h6v6" />
        </svg>
      )
    case 'sports':
      return (
        <svg {...common}>
          <path d="M6 12h12" />
          <path d="M4 10v4" />
          <path d="M6 9v6" />
          <path d="M18 9v6" />
          <path d="M20 10v4" />
        </svg>
      )
    case 'health':
      return (
        <svg {...common}>
          <path d="M12 21s-7-4.4-9-8.6C1.3 8.6 3.6 5.6 6.6 5.6c1.9 0 3.5 1.2 5.4 3.2 1.9-2 3.5-3.2 5.4-3.2 3 0 5.3 3 3.6 6.8-2 4.2-9 8.6-9 8.6Z" />
        </svg>
      )
    case 'toys':
      return (
        <svg {...common}>
          <path d="M2 8h20v4H2z" />
          <path d="M4 12h16v9H4z" />
          <path d="M12 8v13" />
          <path d="M12 8c-2.2 0-4-1.2-4-2.8 0-1.6 1.8-2 3-.9C11.6 4.9 12 6 12 6s.4-1.1 1-1.7c1.2-1.1 3-.7 3 .9 0 1.6-1.8 2.8-4 2.8Z" />
        </svg>
      )
    case 'automotive':
      return (
        <svg {...common}>
          <path d="M6 16l1-4a2 2 0 0 1 2-1h6a2 2 0 0 1 2 1l1 4" />
          <path d="M4 16h16v3a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H10a2 2 0 0 1-4 0H5a1 1 0 0 1-1-1v-3Z" />
          <path d="M7 18h.01" />
          <path d="M17 18h.01" />
        </svg>
      )
    case 'office':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
      )
    case 'other':
    default:
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" />
          <path d="M3.3 7.7 12 12l8.7-4.3" />
          <path d="M12 22V12" />
        </svg>
      )
  }
}

export function ProductImage(props: ProductImageProps) {
  const { src, alt, categoryKey, className, fallbackClassName, onError, ...rest } = props
  const [failed, setFailed] = useState(false)

  const cleanSrc = useMemo(() => {
    if (!src) return null
    const v = typeof src === 'string' ? src.trim() : ''
    return v ? v : null
  }, [src])

  const showFallback = failed || !cleanSrc
  const key: CategoryKey = categoryKey ?? 'other'

  if (showFallback) {
    return (
      <div
        className={clsx('absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500', fallbackClassName)}
        role="img"
        aria-label={alt}
      >
        <div className="h-[60%] w-[60%]">
          <CategoryPlaceholder categoryKey={key} />
        </div>
      </div>
    )
  }

  return (
    <Image
      {...rest}
      src={cleanSrc}
      alt={alt}
      className={className}
      onError={(e) => {
        try {
          onError?.(e)
        } finally {
          setFailed(true)
        }
      }}
    />
  )
}

