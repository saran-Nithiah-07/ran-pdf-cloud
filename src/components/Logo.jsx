// Mark reproduced from the client's icon-red.svg (PdfinityRedLogoKit),
// wordmark colouring matched to logo-primary-red.svg: "Pdf" in the brand
// gradient's deep-red stop, "inity" in ink.
export default function Logo({ withName = true }) {
  return (
    <div className="brand">
      <div className="logo">
        <svg viewBox="0 0 256 256" aria-label="Pdfinity">
          <defs>
            <linearGradient id="pf-mark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff5252" />
              <stop offset="1" stopColor="#c81026" />
            </linearGradient>
          </defs>
          <rect width="256" height="256" rx="58" fill="url(#pf-mark)" />
          <g transform="translate(128 128) scale(1.12) translate(-100 -60)">
            <path
              d="M100,60 C74,26 40,34 40,60 C40,86 74,94 100,60 C126,26 160,34 160,60 C160,86 126,94 100,60 Z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="20"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
      {withName && (
        <span>
          <span style={{ color: "#c81026" }}>Pdf</span>
          <span style={{ color: "#1c2333" }}>inity</span>
        </span>
      )}
    </div>
  );
}
