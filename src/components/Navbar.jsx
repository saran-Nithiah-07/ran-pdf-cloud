import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import Logo from "./Logo";

export default function Navbar() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.email || "";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="navbar">
      <Logo />

      <div className="user-chip">
        {/* Profile page isn't built yet — this is just the visual entry
            point for now, no click behavior until that's specified. */}
        <div className="avatar" title={displayName}>
          {initial}
        </div>
        <span>{displayName}</span>
        <button className="btn-ghost" style={{ width: "auto", padding: "6px 12px" }} onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
