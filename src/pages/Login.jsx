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

  const justSignedUp = location.state?.justSignedUp;
  const justReset = location.state?.justReset;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      // Login is by username, but Supabase Auth signs in by email — so we
      // resolve username -> email first via a security-definer function
      // that only exposes the email match, not the whole profiles table.
      const { data: email, error: lookupErr } = await supabase.rpc(
        "get_email_by_username",
        { lookup_username: username.trim() }
      );
      if (lookupErr) throw lookupErr;

      if (!email) {
        setError("Invalid username or password.");
        setLoading(false);
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInErr) {
        setError("Invalid username or password.");
        setLoading(false);
        return;
      }

      navigate("/dashboard");
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

        {justSignedUp && (
          <div className="form-success">
            Account created — log in to continue.
          </div>
        )}
        {justReset && (
          <div className="form-success">
            Password reset — log in with your new password.
          </div>
        )}
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="janedoe"
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
          <span>
            New here? <Link to="/signup">Create an account</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
