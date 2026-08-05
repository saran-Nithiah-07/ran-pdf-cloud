import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Logo from "../components/Logo";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    if (!form.fullName.trim()) return "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return "Enter a valid email address.";
    if (!USERNAME_RE.test(form.username))
      return "Username must be 3–20 characters: letters, numbers, or underscores.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) return "Passwords don't match.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // Check username availability up front for a clearer error than a
      // raw unique-constraint violation later.
      const { data: available, error: availErr } = await supabase.rpc(
        "is_username_available",
        { check_username: form.username }
      );
      if (availErr) throw availErr;
      if (available === false) {
        setError("That username is already taken.");
        setLoading(false);
        return;
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName, username: form.username }
        }
      });
      if (signUpErr) throw signUpErr;
      if (!data.user) throw new Error("Signup did not return a user.");

      // Email confirmation is disabled on this project, so signUp() already
      // returns an active session — use it just long enough to write the
      // profile row (RLS requires auth.uid() = id), then sign back out so
      // the person lands on the login page as designed, not auto-logged-in.
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: form.fullName,
        username: form.username
      });
      if (profileErr) throw profileErr;

      await supabase.auth.signOut();
      navigate("/login", { state: { justSignedUp: true } });
    } catch (err) {
      setError(err.message || "Something went wrong creating your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Logo />
        <h1>Create your account</h1>
        <p className="sub">Edit, merge, and sign PDFs from anywhere.</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="fullName">Name</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={form.fullName}
              onChange={update("fullName")}
              placeholder="Jane Doe"
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              placeholder="jane@example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={update("username")}
              placeholder="janedoe"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={update("password")}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={update("confirmPassword")}
                placeholder="Repeat password"
              />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Create account"}
          </button>
        </form>

        <div className="auth-links">
          <span>
            Already have an account? <Link to="/login">Log in</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
