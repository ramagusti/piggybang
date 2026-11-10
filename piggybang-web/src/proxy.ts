import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
const RESERVED = new Set(["www", "app", "api"]);

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Optimistic auth check; the API is the real gate.
  const appMatch = pathname.match(/^(\/(?:id|en))?\/app(\/|$)/);
  if (appMatch && !req.cookies.get("pb_token")) {
    const url = req.nextUrl.clone();
    url.pathname = `${appMatch[1] ?? ""}/login`;
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const res = intl(req);

  // {slug}.piggybang.app → remember slug; the client picks the org whose slug matches.
  const host = (req.headers.get("host") ?? "").split(":")[0];
  if (ROOT_DOMAIN && host.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = host.slice(0, -(ROOT_DOMAIN.length + 1));
    if (slug && !slug.includes(".") && !RESERVED.has(slug)) {
      res.cookies.set("pb_org_slug", slug, { path: "/", sameSite: "lax" });
    }
  }
  return res;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
