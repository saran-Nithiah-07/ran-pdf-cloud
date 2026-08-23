import Logo from "./Logo";

// Shared shell for every auth screen (Login, Forgot Password, Accept
// Invite): left brand panel with the signature "floating pages +
// infinity mark" illustration, right the actual form. The left panel
// hides below tablet width — theme.css swaps in a small logo above the
// form instead, so the page still feels branded on mobile.
export default function AuthLayout({ headline, tagline, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <Logo />

        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-page auth-page-1" />
          <div className="auth-page auth-page-2" />
          <div className="auth-page auth-page-3" />
          <svg className="auth-infinity" viewBox="0 0 256 256" fill="none">
            <path
              d="M100,60 C74,26 40,34 40,60 C40,86 74,94 100,60 C126,26 160,34 160,60 C160,86 126,94 100,60 Z"
              stroke="#fff"
              strokeWidth="14"
              fill="none"
            />
          </svg>
        </div>

        <div className="auth-brand-copy">
          <h2>{headline}</h2>
          <p>{tagline}</p>
        </div>

        <div className="auth-brand-foot">© {new Date().getFullYear()} Pdfinity</div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
