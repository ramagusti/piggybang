// Built but hidden for launch. The backend endpoints still exist; flip to true to show them again.
export const FEATURES = {
  subdomains: false, // {slug}.piggybang.app team URLs (settings field)
  webhooks: false, // outgoing transaction webhook (settings field)
  apiTokens: false, // personal API tokens (settings section)
} as const;
