'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center px-4 py-12">
          <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/30 dark:bg-red-950/20">
            <div className="mb-4 text-4xl">⚠️</div>
            <h2 className="mb-2 text-xl font-semibold text-red-900 dark:text-red-200">Something went wrong</h2>
            <p className="mb-4 text-sm text-red-700 dark:text-red-300">
              We encountered an unexpected error. Please try again or contact support if the problem persists.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 rounded-lg bg-red-100 p-3 text-left dark:bg-red-900/30">
                <summary className="cursor-pointer text-xs font-semibold text-red-900 dark:text-red-200">
                  Error details
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-800 dark:text-red-300">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
            <button
              onClick={this.reset}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional wrapper for easier use with optional Sentry integration
export function ErrorBoundaryWrapper({
  children,
  onError,
}: {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}) {
  return <ErrorBoundary onError={onError}>{children}</ErrorBoundary>
}
