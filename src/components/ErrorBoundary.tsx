import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: unknown[]
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys && prevProps.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      )
      if (hasChanged) {
        this.reset()
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="component-error-boundary" role="alert" style={{
          padding: '16px',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          background: '#fef2f2',
          color: '#991b1b',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          margin: '8px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 750, fontSize: '13.5px' }}>
            <AlertCircle size={18} aria-hidden="true" color="#dc2626" />
            <span>Rendering error</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', lineHeight: 1.45 }}>
            {this.state.error.message || 'An unexpected error occurred while rendering this component.'}
          </p>
          <button
            type="button"
            className="button ghost"
            onClick={this.reset}
            style={{
              alignSelf: 'flex-start',
              marginTop: '4px',
              minHeight: '36px',
              padding: '6px 12px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
