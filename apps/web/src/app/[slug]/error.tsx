'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function SlugError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Sheet page error:', error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-lg mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
          Failed to load rank sheet
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          We encountered an error while loading this rank sheet. This may be a temporary issue.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Try again
          </button>
          <Link
            href="/"
            className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-6 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Browse all sheets
          </Link>
        </div>
      </div>
    </div>
  )
}
