'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    logger.error('React Error Boundary', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
            <Button onClick={() => window.location.reload()}>Reload Page</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

