import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

// Guards /dashboard and /doc-editor. Any logged-in user may see these,
// EXCEPT an admin — admins only get the admin panel (user list), never
// the regular file dashboard/editor. Enforced here, not just by not
// linking to it, since someone could otherwise just type the URL
// directly or land on a stale bookmark/back-button state.
export default function ProtectedRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-shell">
        <span className="spinner" style={{ borderTopColor: "#c81026" }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return children;
}
