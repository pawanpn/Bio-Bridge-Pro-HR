// ============================================================
// Bio-Bridge Pro HR — Error Boundary
// Wrap App root AND each page with this.
// Usage:
//   <ErrorBoundary>        ← catches everything
//     <ErrorBoundary scope="Payroll">  ← page-level, isolated
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Label for the error UI — e.g. "Payroll", "Dashboard" */
  scope?: string;
  /** Custom fallback instead of the default error card */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info });
    // In production, send to Supabase error log or Sentry
    console.error(`[ErrorBoundary:${this.props.scope ?? "App"}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            padding: "2rem",
            maxWidth: "480px",
            margin: "4rem auto",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            background: "var(--color-background-primary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
            <span style={{ fontSize: "20px", color: "#E24B4A" }}>⚠</span>
            <h2 style={{ fontSize: "16px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
              {this.props.scope
                ? `Something went wrong in ${this.props.scope}`
                : "Something went wrong"}
            </h2>
          </div>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "1rem", lineHeight: 1.6 }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          {import.meta.env.DEV && this.state.errorInfo && (
            <pre
              style={{
                fontSize: "11px",
                background: "var(--color-background-secondary)",
                padding: "8px",
                borderRadius: "4px",
                overflow: "auto",
                maxHeight: "120px",
                color: "var(--color-text-secondary)",
                marginBottom: "1rem",
              }}
            >
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-primary)",
                cursor: "pointer",
                color: "var(--color-text-primary)",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-secondary)",
                cursor: "pointer",
                color: "var(--color-text-secondary)",
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
