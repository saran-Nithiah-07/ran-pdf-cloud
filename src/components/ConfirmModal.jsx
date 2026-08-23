// A modern in-app confirmation dialog to replace window.confirm(), which
// renders as an ugly native browser popup outside the app's own design.
// Controlled entirely by the caller: pass `open`, wire up onConfirm/onCancel,
// and pass `loading` while the confirmed action is in flight — the modal
// stays open with a spinner on the confirm button until the caller closes it.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => !loading && onCancel?.()}>
      <div className="modal-card confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon-circle ${danger ? "danger" : ""}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
        <h2>{title}</h2>
        {message && <p className="sub">{message}</p>}
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn-ghost"
            style={{ width: "auto", padding: "10px 16px" }}
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            style={{ width: "auto", padding: "10px 18px" }}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? <span className="spinner" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
