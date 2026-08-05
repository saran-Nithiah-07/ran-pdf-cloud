// Exact same SVG mark used inside RAN-PDF-Editor-Pro.html, reused here so
// the login/dashboard shell and the editor share one brand identity.
export default function Logo({ withName = true }) {
  return (
    <div className="brand">
      <div className="logo">
        <svg viewBox="0 0 256 256" aria-label="RAN">
          <rect width="256" height="256" rx="58" fill="url(#rg)" />
          <path
            d="M74 52 h74 l34 34 v118 a8 8 0 0 1 -8 8 H74 a8 8 0 0 1 -8 -8 V60 a8 8 0 0 1 8 -8 z"
            fill="#fff"
          />
          <path
            d="M148 52 l34 34 h-30 a4 4 0 0 1 -4 -4 z"
            fill="#d7def0"
          />
          <text
            x="124"
            y="132"
            textAnchor="middle"
            fontFamily="Arial,Helvetica,sans-serif"
            fontSize="46"
            fontWeight="800"
            fill="#1c2a4a"
          >
            RAN
          </text>
          <path
            d="M66 150 h116 v26 a8 8 0 0 1 -8 8 H74 a8 8 0 0 1 -8 -8 z"
            fill="#e5342a"
          />
          <text
            x="124"
            y="174"
            textAnchor="middle"
            fontFamily="Arial,Helvetica,sans-serif"
            fontSize="20"
            fontWeight="800"
            fill="#fff"
          >
            PDF
          </text>
          <defs>
            <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3457e0" />
              <stop offset="1" stopColor="#7b3ee0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {withName && <span>RAN PDF Editor Pro</span>}
    </div>
  );
}
