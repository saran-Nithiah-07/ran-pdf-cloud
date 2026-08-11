import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import Navbar from "../components/Navbar";

const FILTERS = ["active", "inactive", "all"];

export default function AdminPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMobile, setInviteMobile] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    const { data, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, full_name, username, email, mobile_number, status, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const visibleUsers = users.filter((u) => filter === "all" || u.status === filter);

  async function handleToggleStatus(u) {
    setBusyId(u.id);
    setError("");
    const newStatus = u.status === "active" ? "inactive" : "active";
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", u.id);
    if (updateErr) {
      setError(updateErr.message);
    } else {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: newStatus } : x)));
    }
    setBusyId(null);
  }

  async function handleDelete(u) {
    if (u.status !== "inactive") return;
    if (
      !window.confirm(
        `Permanently delete "${u.full_name}"? This removes their account and every file they've uploaded. This can't be undone.`
      )
    )
      return;

    setBusyId(u.id);
    setError("");
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const { data, error: fnErr } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: u.id },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      setError(err.message || "Couldn't delete that user.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");

    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError("Name and email are required.");
      return;
    }

    setInviting(true);
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const { data, error: fnErr } = await supabase.functions.invoke("admin-invite-user", {
        body: {
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          mobile: inviteMobile.trim(),
          origin: window.location.origin
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}.`);
      setInviteName("");
      setInviteEmail("");
      setInviteMobile("");
      await loadUsers();
      setTimeout(() => {
        setShowInvite(false);
        setInviteSuccess("");
      }, 1500);
    } catch (err) {
      setInviteError(err.message || "Couldn't send that invite.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />
      <div className="dash-body">
        <div className="dash-head">
          <div>
            <h1>Admin</h1>
            <p>Signed in as {profile?.full_name} — manage who has access to Pdfinity.</p>
          </div>
          <button className="upload-btn" onClick={() => setShowInvite(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" />
            </svg>
            Invite user
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="admin-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`admin-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "var(--sub)" }}>Loading users…</p>
        ) : visibleUsers.length === 0 ? (
          <div className="empty-state">
            <h3>No users here</h3>
            <p>
              {filter === "active"
                ? "No active users yet — invite one to get started."
                : `No ${filter} users.`}
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.mobile_number || "—"}</td>
                    <td>
                      <span className={`type-badge ${u.status === "active" ? "pdf" : "docx"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="admin-actions">
                      <button
                        className="icon-btn admin-text-btn"
                        disabled={busyId === u.id}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="delete-btn admin-text-btn"
                        disabled={busyId === u.id || u.status !== "inactive"}
                        title={
                          u.status !== "inactive" ? "Deactivate this user before deleting" : "Delete"
                        }
                        onClick={() => handleDelete(u)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Invite a user</h2>
            <p className="sub">They'll get an email to set their own password.</p>

            {inviteError && <div className="form-error">{inviteError}</div>}
            {inviteSuccess && <div className="form-success">{inviteSuccess}</div>}

            <form onSubmit={handleInvite}>
              <div className="field">
                <label htmlFor="inviteName">Name</label>
                <input
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="field">
                <label htmlFor="inviteEmail">Email</label>
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="field">
                <label htmlFor="inviteMobile">Mobile number</label>
                <input
                  id="inviteMobile"
                  value={inviteMobile}
                  onChange={(e) => setInviteMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ width: "auto", padding: "10px 16px" }}
                  onClick={() => setShowInvite(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={inviting}>
                  {inviting ? <span className="spinner" /> : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
