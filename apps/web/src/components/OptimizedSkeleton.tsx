import { type CSSProperties } from 'react'

interface SkeletonProps {
  /**
   * Width of the skeleton (CSS value: px, %, rem, etc.)
   */
  width?: string | number
  /**
   * Height of the skeleton (CSS value: px, %, rem, etc.)
   */
  height?: string | number
  /**
   * Border radius (CSS value)
   */
  radius?: string | number
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Animation variant
   */
  variant?: 'pulse' | 'wave' | 'none'
  /**
   * Shape preset
   */
  shape?: 'text' | 'rect' | 'circle' | 'avatar'
}

function normalizeValue(value: string | number | undefined): string | undefined {
  if (typeof value === 'number') {
    return `${value}px`
  }
  return value
}

/**
 * Optimized skeleton loader component with fixed dimensions to prevent CLS
 *
 * Features:
 * - Fixed dimensions (prevents layout shift)
 * - Multiple animation variants
 * - Shape presets for common use cases
 * - Minimal bundle size
 *
 * Usage:
 * ```tsx
 * // Text line
 * <Skeleton shape="text" width="200px" height="20px" />
 *
 * // Avatar
 * <Skeleton shape="avatar" width={40} height={40} />
 *
 * // Custom rectangle
 * <Skeleton width="100%" height="300px" radius="8px" />
 * ```
 */
export function Skeleton({
  width,
  height,
  radius,
  className = '',
  variant = 'pulse',
  shape = 'rect',
}: SkeletonProps) {
  // Preset dimensions based on shape
  const presets: Record<string, Partial<CSSProperties>> = {
    text: {
      width: width ?? '100%',
      height: height ?? '1em',
      borderRadius: radius ?? '4px',
    },
    rect: {
      width: width ?? '100%',
      height: height ?? '100px',
      borderRadius: radius ?? '8px',
    },
    circle: {
      width: width ?? '40px',
      height: height ?? '40px',
      borderRadius: '50%',
    },
    avatar: {
      width: width ?? '40px',
      height: height ?? '40px',
      borderRadius: '50%',
    },
  }

  const style: CSSProperties = {
    ...presets[shape],
    width: normalizeValue(width) ?? presets[shape]?.width,
    height: normalizeValue(height) ?? presets[shape]?.height,
    borderRadius: normalizeValue(radius) ?? presets[shape]?.borderRadius,
    backgroundColor: 'rgb(229 231 235)', // gray-200
    display: 'inline-block',
    position: 'relative',
    overflow: 'hidden',
  }

  const animationClass = {
    pulse: 'animate-pulse',
    wave: 'skeleton-wave',
    none: '',
  }[variant]

  return (
    <span className={`${animationClass} ${className}`.trim()} style={style} aria-hidden="true">
      {variant === 'wave' && (
        <span
          className="skeleton-wave-animation"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
            animation: 'skeleton-wave 1.5s ease-in-out infinite',
          }}
        />
      )}
    </span>
  )
}

/**
 * Skeleton for sheet table row (optimized for rank sheets)
 */
export function SkeletonSheetRow() {
  return (
    <div className="flex items-center gap-4 py-3 border-b" style={{ minHeight: '80px' }}>
      {/* Rank */}
      <Skeleton shape="text" width={30} height={24} />

      {/* Image */}
      <Skeleton shape="rect" width={60} height={60} radius="4px" />

      {/* Product info */}
      <div className="flex-1 space-y-2">
        <Skeleton shape="text" width="80%" height={16} />
        <Skeleton shape="text" width="40%" height={14} />
      </div>

      {/* Scores */}
      <div className="flex gap-2">
        <Skeleton shape="rect" width={60} height={32} radius="16px" />
        <Skeleton shape="rect" width={60} height={32} radius="16px" />
      </div>
    </div>
  )
}

/**
 * Skeleton for full sheet page
 */
export function SkeletonSheetPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton shape="text" width="60%" height={32} />
        <Skeleton shape="text" width="40%" height={20} />
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Skeleton shape="rect" width={200} height={80} radius="8px" />
        <Skeleton shape="rect" width={200} height={80} radius="8px" />
        <Skeleton shape="rect" width={200} height={80} radius="8px" />
      </div>

      {/* Table */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonSheetRow key={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for product card
 */
export function SkeletonProductCard() {
  return (
    <div className="border rounded-lg p-4 space-y-3" style={{ minHeight: '200px' }}>
      <Skeleton shape="rect" width="100%" height={120} radius="4px" />
      <Skeleton shape="text" width="90%" height={16} />
      <Skeleton shape="text" width="60%" height={14} />
      <div className="flex gap-2">
        <Skeleton shape="rect" width={80} height={28} radius="4px" />
        <Skeleton shape="rect" width={80} height={28} radius="4px" />
      </div>
    </div>
  )
}
