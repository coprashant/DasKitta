import { Component } from "react";

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        // hook up to a logging service here if one is added later
        console.error("Unhandled UI error:", error, info);
    }

    handleReload = () => {
        this.setState({ hasError: false });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    role="alert"
                    style={{
                        minHeight: "100vh",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        textAlign: "center",
                        padding: 24,
                        background: "var(--bg)",
                        color: "var(--text)",
                    }}
                >
                    <h2 style={{ margin: 0 }}>Something went wrong</h2>
                    <p style={{ margin: 0, color: "var(--text-3)" }}>
                        Please reload the page. If the problem continues, contact support.
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={this.handleReload}
                    >
                        Reload
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;