import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-shell">
        <span className="spinner" style={{ borderTopColor: "#3457e0" }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
}
