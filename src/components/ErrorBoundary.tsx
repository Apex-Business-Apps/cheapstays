import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional reset keys — when any key changes the boundary resets automatically. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      this.state.hasError &&
      prevProps.resetKeys !== this.props.resetKeys &&
      this.props.resetKeys?.some((key, i) => key !== prevProps.resetKeys?.[i])
    ) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      const isDev = !import.meta.env.PROD;
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
          <h2 className="text-2xl font-semibold text-destructive">Something went wrong</h2>
          <p className="text-muted-foreground max-w-md">
            {isDev
              ? (this.state.error?.message ?? "An unexpected error occurred.")
              : "An unexpected error occurred. Please try again or contact support."}
          </p>
          {isDev && this.state.error?.stack && (
            <pre className="text-left text-xs bg-muted rounded p-4 max-w-2xl overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
