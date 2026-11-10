import Link from "next/link";

// Requests outside a locale (rare; the proxy adds one). Plain fallback.
export default function GlobalNotFound() {
  return (
    <html lang="id">
      <body style={{ fontFamily: "sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", background: "#FFFBEB", color: "#1E1B4B" }}>
        <div style={{ textAlign: "center" }}>
          <h1>404</h1>
          <Link href="/">PiggyBang!</Link>
        </div>
      </body>
    </html>
  );
}
