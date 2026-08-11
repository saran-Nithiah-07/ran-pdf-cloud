import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

// Guards /admin specifically. A regular ProtectedRoute only checks "is
// anyone logged in" — this additionally checks "is it an admin", and
// sends anyone else to their normal dashboard rather than showing them
// the admin screen or an error. Enforced here, not just by not linking to
// it, since someone could otherwise just type the URL directly.
export default function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-shell">
        <span className="spinner" style={{ borderTopColor: "#c81026" }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
