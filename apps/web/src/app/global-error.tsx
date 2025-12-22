'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Something went wrong!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              We&apos;re sorry, but something unexpected happened. Our team has been notified.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-mono">
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
