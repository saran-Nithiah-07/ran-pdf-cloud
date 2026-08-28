import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Which conversion types can ever be logged under each provider — used to
// only render breakdown rows that are actually possible, rather than
// padding every provider with all 5 types regardless of whether that
// engine could have produced them.
const CONVERSION_LABELS = {
  "word-to-pdf": "Word → PDF",
  "pptx-to-pdf": "PPTX → PDF",
  "excel-to-pdf": "Excel → PDF",
  "pdf-to-word": "PDF → Word",
  "pdf-to-pptx": "PDF → PPTX"
};

const PROVIDER_META = {
  "adobe-1": { label: "Adobe 1", color: "#c81026" },
  "adobe-2": { label: "Adobe 2", color: "#2166c9" },
  local: { label: "Custom converter", color: "#189a63" }
};
const PROVIDER_ORDER = ["adobe-1", "adobe-2", "local"];

function formatMonth(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function CreditDetailsModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState([]); // [{month, provider, total}]
  const [detailed, setDetailed] = useState([]); // [{month, provider, conversion_type, total}]
  const [expandedKey, setExpandedKey] = useState(null); // `${month}|${provider}`

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      const [summaryRes, detailedRes] = await Promise.all([
        supabase.rpc("get_conversion_stats_by_month"),
        supabase.rpc("get_conversion_stats_by_month_detailed")
      ]);

      if (cancelled) return;

      if (summaryRes.error || detailedRes.error) {
        setError((summaryRes.error || detailedRes.error).message);
        setLoading(false);
        return;
      }

      setSummary(summaryRes.data || []);
      setDetailed(detailedRes.data || []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const rows = useMemo(() => {
    const byMonth = new Map();
    for (const row of summary) {
      const key = row.month;
      if (!byMonth.has(key)) byMonth.set(key, { month: key });
      byMonth.get(key)[row.provider] = Number(row.total);
    }
    return Array.from(byMonth.values()).sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [summary]);

  const detailedByKey = useMemo(() => {
    const map = new Map();
    for (const row of detailed) {
      const key = `${row.month}|${row.provider}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return map;
  }, [detailed]);

  if (!open) return null;

  function toggleCell(month, provider, total) {
    if (!total) return;
    const key = `${month}|${provider}`;
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card credit-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <h2>Credit usage</h2>
        <p className="sub">Conversions by month, split across both Adobe accounts and the custom converter.</p>

        {error ? (
          <p className="form-error">Couldn't load credit usage: {error}</p>
        ) : loading ? (
          <div className="credit-loading">
            <span className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--sub)", padding: "8px 0 4px" }}>No conversions logged yet.</p>
        ) : (
          <div className="credit-table">
            <div className="credit-table-head">
              <span>Month</span>
              {PROVIDER_ORDER.map((p) => (
                <span key={p} className="credit-head-provider">
                  <span className="credit-dot" style={{ background: PROVIDER_META[p].color }} />
                  {PROVIDER_META[p].label}
                </span>
              ))}
            </div>

            {rows.map((row) => (
              <div className="credit-month-group" key={row.month}>
                <div className="credit-table-row">
                  <span className="credit-month-label">{formatMonth(row.month)}</span>
                  {PROVIDER_ORDER.map((provider) => {
                    const total = row[provider] || 0;
                    const key = `${row.month}|${provider}`;
                    const isOpen = expandedKey === key;
                    return (
                      <button
                        type="button"
                        key={provider}
                        className={`credit-cell ${total ? "clickable" : ""} ${isOpen ? "open" : ""}`}
                        onClick={() => toggleCell(row.month, provider, total)}
                        disabled={!total}
                      >
                        {total}
                        {total > 0 && (
                          <svg
                            className="credit-chevron"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>

                {PROVIDER_ORDER.map((provider) => {
                  const key = `${row.month}|${provider}`;
                  const isOpen = expandedKey === key;
                  const items = detailedByKey.get(key) || [];
                  return (
                    <div className={`credit-accordion ${isOpen ? "open" : ""}`} key={provider}>
                      <div className="credit-accordion-inner">
                        <div className="credit-accordion-head">
                          <span className="credit-dot" style={{ background: PROVIDER_META[provider].color }} />
                          {PROVIDER_META[provider].label} — breakdown by conversion type
                        </div>
                        <div className="credit-accordion-grid">
                          {items.length === 0 ? (
                            <span style={{ color: "var(--sub)", fontSize: 13 }}>No conversions.</span>
                          ) : (
                            items
                              .sort((a, b) => b.total - a.total)
                              .map((item) => (
                                <div className="credit-accordion-item" key={item.conversion_type}>
                                  <span className="credit-accordion-item-label">
                                    {CONVERSION_LABELS[item.conversion_type] || item.conversion_type}
                                  </span>
                                  <span className="credit-accordion-item-value">{item.total}</span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
