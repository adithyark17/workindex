import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="shell header-inner">
        <Link className="wordmark" href="/" aria-label="WorkIndex home">
          Work<span>Index</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/gcc">GCC tracker</Link>
          <Link href="/methodology">Methodology</Link>
          <a href="#signal">Get the Signal</a>
        </nav>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <AuthControls /> : null}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <p className="wordmark">Work<span>Index</span></p>
          <p>India&apos;s tech opportunity, indexed.</p>
        </div>
        <p>Every signal should show its source, freshness, and confidence.</p>
      </div>
    </footer>
  );
}
