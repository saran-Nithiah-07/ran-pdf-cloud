import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Logo from "../components/Logo";
import AuthLayout from "../components/AuthLayout";

// Landed on after clicking the invite email link — Supabase's invite flow
// signs the person into a temporary session automatically (same
// detectSessionInUrl mechanism as password reset). This page's only job
// is to let them set a real password, then send them to the normal login.
export default function AcceptInvite() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      await supabase.auth.signOut();
      navigate("/login", { state: { justInvited: true } });
    } catch (err) {
      setError(
        err.message ||
          "Couldn't set your password. The invite link may have expired — ask your administrator to resend it."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      headline="You've been invited."
      tagline="One last step — set a password and your account is ready."
    >
      <Logo />
      <h1>Welcome to Pdfinity</h1>
      <p className="sub">Set a password to finish creating your account.</p>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : "Set password & continue"}
        </button>
      </form>
    </AuthLayout>
  );
}
