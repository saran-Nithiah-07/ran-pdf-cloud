import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Logo from "../components/Logo";
import AuthLayout from "../components/AuthLayout";

// Step 1: enter email, we send a one-time code.
// Step 2: enter the code, which signs the person in via a recovery session.
// Step 3: set a new password using that session, then sign out.
const STEPS = { EMAIL: 1, OTP: 2, NEW_PASSWORD: 3 };

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error: sendErr } = await supabase.auth.resetPasswordForEmail(
        email
      );
      if (sendErr) throw sendErr;
      // Deliberately not revealing whether the email matched an account —
      // Supabase returns success either way to avoid leaking that.
      setStep(STEPS.OTP);
    } catch (err) {
      setError(err.message || "Couldn't send the code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    if (!otp.trim()) {
      setError("Enter the code from your email.");
      return;
    }

    setLoading(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "recovery"
      });
      if (verifyErr) throw verifyErr;
      setStep(STEPS.NEW_PASSWORD);
    } catch (err) {
      setError(err.message || "That code didn't work. Check it and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateErr) throw updateErr;

      await supabase.auth.signOut();
      navigate("/login", { state: { justReset: true } });
    } catch (err) {
      setError(err.message || "Couldn't update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      headline="Forgot your password? It happens."
      tagline="We'll get you a fresh one in three quick steps."
    >
      <Logo />
      <h1>Reset your password</h1>
      <p className="sub">
        {step === STEPS.EMAIL && "We'll email you a one-time code."}
        {step === STEPS.OTP && `Enter the code sent to ${email}.`}
        {step === STEPS.NEW_PASSWORD && "Choose a new password."}
      </p>

      <div className="stepper">
        <div className={`dot ${step >= STEPS.EMAIL ? "active" : ""}`} />
        <div className={`dot ${step >= STEPS.OTP ? "active" : ""}`} />
        <div className={`dot ${step >= STEPS.NEW_PASSWORD ? "active" : ""}`} />
      </div>

      {error && <div className="form-error">{error}</div>}

      {step === STEPS.EMAIL && (
        <form onSubmit={handleSendCode}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Send code"}
          </button>
        </form>
      )}

      {step === STEPS.OTP && (
        <form onSubmit={handleVerifyOtp}>
          <div className="field">
            <label htmlFor="otp">Verification code</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Verify code"}
          </button>
        </form>
      )}

      {step === STEPS.NEW_PASSWORD && (
        <form onSubmit={handleSetNewPassword}>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
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
            {loading ? <span className="spinner" /> : "Reset password"}
          </button>
        </form>
      )}

      <div className="auth-links">
        <Link to="/login">Back to login</Link>
      </div>
    </AuthLayout>
  );
}
