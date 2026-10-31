"use client";

import Link from "next/link";

// The root layout and its stylesheet may be unavailable here.
export default function GlobalError() {
  return <html lang="en"><body style={{ margin: 0, background: "#f8f2e9", color: "#101217", fontFamily: "Arial, sans-serif" }}>
    <main id="main-content" tabIndex={-1} style={{ maxWidth: "40rem", margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.6 }}>
      <h1>Page unavailable</h1>
      <p>We could not load this page. If you were creating an invoice, check your invoice list before submitting again.</p>
      <button style={{ minHeight: 44, padding: "0.75rem 1.5rem", borderRadius: "2rem", background: "#101217", color: "#f8f2e9", font: "inherit", cursor: "pointer" }} onClick={() => window.location.reload()}>Try again</button>
      <p><Link style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "inherit" }} href="/">Return home</Link></p>
    </main>
  </body></html>;
}
