import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";

const FILTERS = ["all", "active", "inactive"];
const PAGE_SIZE = 10;

const AVATAR_PALETTE = [
  { bg: "#fde3e1", fg: "#e0473e" },
  { bg: "#fdead0", fg: "#c98a1b" },
  { bg: "#e6e0fb", fg: "#6d4fd6" },
  { bg: "#dcf3e6", fg: "#189a63" },
  { bg: "#dcecfb", fg: "#2166c9" },
  { bg: "#fbe0ef", fg: "#c22a80" }
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function getAvatarColors(seed) {
  let hash = 0;
  for (let i = 0; i < (seed || "").length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// Escapes characters that are special to PostgREST's `ilike` pattern
// matching so a search string like "50% off" or "a,b" can't break the
// query or match more broadly than intended.
function escapeForIlike(value) {
  return value.replace(/[%_,]/g, (c) => `\\${c}`);
}

export default function AdminPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMobile, setInviteMobile] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const [confirmUser, setConfirmUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce free-text search so we're not hitting Supabase on every
  // keystroke — the actual filtering happens server-side in loadUsers().
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // All filtering, searching, and pagination happens in the query itself
  // (status filter, name/email search, range) rather than fetching every
  // user and slicing/filtering in the browser.
  async function loadUsers(pageOverride) {
    const currentPage = pageOverride ?? page;
    setLoading(true);
    setError("");

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("profiles")
      .select("id, full_name, username, email, mobile_number, status, created_at", {
        count: "exact"
      })
      .eq("role", "user");

    if (filter !== "all") query = query.eq("status", filter);
    if (search) {
      const s = escapeForIlike(search);
      query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
    }

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, error: fetchErr, count } = await query;

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    const rows = data || [];
    // If a mutation (delete) emptied out the last page, step back a page
    // instead of showing a dead end.
    if (rows.length === 0 && currentPage > 0 && (count || 0) > 0) {
      const lastPage = Math.max(0, Math.ceil((count || 0) / PAGE_SIZE) - 1);
      setPage(lastPage);
      return;
    }

    setUsers(rows);
    setTotalCount(count || 0);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, page]);

  function handleFilterChange(f) {
    setFilter(f);
    setPage(0);
  }

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
      setBusyId(null);
    } else {
      await loadUsers();
      setBusyId(null);
    }
  }

  function requestDelete(u) {
    if (u.status !== "inactive") return;
    setError("");
    setConfirmUser(u);
  }

  async function confirmDelete() {
    if (!confirmUser) return;
    setDeleting(true);
    setError("");
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const { data, error: fnErr } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: confirmUser.id },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      setConfirmUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.message || "Couldn't delete that user.");
    } finally {
      setDeleting(false);
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
      setPage(0);
      await loadUsers(0);
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * PAGE_SIZE + PAGE_SIZE);

  // Compact page-number list: always show first, last, current, and a
  // couple of neighbors, with "…" gaps — avoids a huge button row when
  // there are many pages.
  function pageNumbers() {
    const nums = new Set([0, totalPages - 1, page, page - 1, page + 1]);
    return [...nums]
      .filter((n) => n >= 0 && n < totalPages)
      .sort((a, b) => a - b);
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

        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Users</h2>
            <div className="admin-card-head-actions">
              <div className="search-bar" style={{ width: 220 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  placeholder="Search name or email"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="admin-filters">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    className={`admin-filter-btn ${filter === f ? "active" : ""}`}
                    onClick={() => handleFilterChange(f)}
                  >
                    {f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <p style={{ color: "var(--sub)", padding: "0 22px 22px" }}>Loading users…</p>
          ) : users.length === 0 ? (
            <div className="empty-state" style={{ margin: "0 22px 22px", border: "1px dashed var(--line)" }}>
              <h3>No users here</h3>
              <p>
                {search
                  ? `No users match "${search}".`
                  : filter === "active"
                  ? "No active users yet — invite one to get started."
                  : `No ${filter} users.`}
              </p>
            </div>
          ) : (
            <>
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
                    {users.map((u) => {
                      const colors = getAvatarColors(u.full_name || u.username || u.email);
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="admin-user-cell">
                              <div
                                className="admin-avatar"
                                style={{ background: colors.bg, color: colors.fg }}
                              >
                                {getInitials(u.full_name)}
                              </div>
                              <span className="admin-user-name">{u.full_name}</span>
                            </div>
                          </td>
                          <td>{u.username}</td>
                          <td>
                            <span className="admin-user-sub">{u.email}</span>
                          </td>
                          <td>{u.mobile_number || "—"}</td>
                          <td>
                            <span className={`status-pill ${u.status}`}>{u.status}</span>
                          </td>
                          <td>
                            <div className="admin-actions">
                              <button
                                className="admin-text-btn"
                                disabled={busyId === u.id}
                                onClick={() => handleToggleStatus(u)}
                              >
                                {busyId === u.id ? (
                                  <span className="spinner" style={{ borderTopColor: "var(--sub)" }} />
                                ) : u.status === "active" ? (
                                  "Deactivate"
                                ) : (
                                  "Activate"
                                )}
                              </button>
                              <button
                                className="admin-icon-btn"
                                disabled={busyId === u.id || u.status !== "inactive"}
                                title={
                                  u.status !== "inactive"
                                    ? "Deactivate this user before deleting"
                                    : "Delete"
                                }
                                onClick={() => requestDelete(u)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="admin-pagination">
                <span className="admin-pagination-info">
                  Showing {rangeStart}–{rangeEnd} of {totalCount}
                </span>
                <div className="admin-pagination-controls">
                  <button
                    className="admin-page-btn"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Prev
                  </button>
                  {pageNumbers().map((n, i, arr) => (
                    <span key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {i > 0 && arr[i - 1] !== n - 1 && (
                        <span style={{ color: "var(--sub)", fontSize: 12 }}>…</span>
                      )}
                      <button
                        className={`admin-page-btn ${n === page ? "active" : ""}`}
                        onClick={() => setPage(n)}
                      >
                        {n + 1}
                      </button>
                    </span>
                  ))}
                  <button
                    className="admin-page-btn"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirmUser}
        title="Delete this user?"
        message={
          confirmUser
            ? `Permanently delete "${confirmUser.full_name}"? This removes their account and every file they've uploaded. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setConfirmUser(null)}
      />

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
