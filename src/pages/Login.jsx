import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Logo from "../components/Logo";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const justReset = location.state?.justReset;
  const justInvited = location.state?.justInvited;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username or email, and your password.");
      return;
    }

    setLoading(true);
    try {
      const input = username.trim();
      let loginEmail;

      if (input.includes("@")) {
        // Looks like an email — use it directly, no lookup needed.
        loginEmail = input;
      } else {
        // Otherwise resolve username -> email via a security-definer
        // function that only exposes the email match, not the whole
        // profiles table.
        const { data: resolvedEmail, error: lookupErr } = await supabase.rpc(
          "get_email_by_username",
          { lookup_username: input }
        );
        if (lookupErr) throw lookupErr;
        if (!resolvedEmail) {
          setError("Invalid username or password.");
          setLoading(false);
          return;
        }
        loginEmail = resolvedEmail;
      }

      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
      });
      if (signInErr) {
        setError("Invalid username or password.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", signInData.user.id)
        .single();

      if (profileErr || !profile) {
        setError("Couldn't load your account. Contact your administrator.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (profile.status === "inactive") {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Contact your administrator.");
        setLoading(false);
        return;
      }

      navigate(profile.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong logging in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Logo />
        <h1>Log in</h1>
        <p className="sub">Pick up where you left off.</p>

        {justReset && (
          <div className="form-success">
            Password reset — log in with your new password.
          </div>
        )}
        {justInvited && (
          <div className="form-success">
            Password set — log in to continue.
          </div>
        )}
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username or email</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="janedoe or jane@example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Log in"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}
