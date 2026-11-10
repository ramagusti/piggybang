// The real root layout (html/body) lives in [locale]/layout.tsx; this one only exists for app/not-found.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
