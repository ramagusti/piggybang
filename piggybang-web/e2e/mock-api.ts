import type { Page, Route } from "@playwright/test";

// Must match the API URL the running web server was built with (E2E_API_URL when reusing a dev server).
export const API = process.env.E2E_API_URL ?? "http://localhost:8000/api";

export const user = { id: 1, name: "Rama Gusti", email: "rama@example.com", avatar_url: null, locale: "id", timezone: "Asia/Jakarta", email_verified_at: null };

export const org = {
  id: 1,
  name: "Keluarga",
  slug: "keluarga",
  plan: "free",
  effective_plan: "pro",
  is_trialing: true,
  trial_ends_at: "2099-01-01T00:00:00Z",
  member_limit: 5,
  whatsapp_mode: null,
  settings: { onboarded: true, currency: "IDR", timezone: "Asia/Jakarta" },
  role: "owner",
  permissions: ["transactions.view", "transactions.write", "categories.write", "rules.write", "bills.write", "members.manage", "whatsapp.manage", "billing.manage", "organization.delete"],
  limits: { categories_per_type: null, members: 5 },
  usage: { members: 1, expense_categories: 7, income_categories: 2 },
};

const tx = (id: number, type: string, amount: string, cat: string, description: string) => ({
  id,
  type,
  amount,
  currency: "IDR",
  description,
  actor: "Rama",
  transaction_time: "2026-08-06T12:30:00+07:00",
  category: { id, name: cat, icon: null, color: null },
  user: { id: 1, name: "Rama" },
  proof_url: null,
  source: "web",
  confidence: null,
  created_at: "2026-08-06T12:30:00+07:00",
});

export const dashboard = {
  kpi: { savings: "-89491625.00", income: "16000000.00", expense: "105491625.00", income_change_pct: 12, expense_change_pct: -8, savings_progress_pct: 86 },
  recent_transactions: [tx(1, "expense", "32000.00", "Food & Beverages", "mixue"), tx(2, "income", "4500000.00", "Salary 2", "gajian")],
  budget_warnings: [],
  upcoming_bills: [],
  expense_by_category: [{ category_id: 1, name: "Food & Beverages", color: null, total: "45000000.00" }],
  transactions_total: 2,
};

/** Route every API call to canned JSON; unknown endpoints → 404 so failures are visible. */
export async function mockApi(page: Page, overrides: Record<string, (route: Route) => unknown> = {}) {
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    const key = `${route.request().method()} ${url.pathname.replace("/api", "")}`;
    if (overrides[key]) return overrides[key](route);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    switch (key) {
      case "POST /auth/login":
        return json({ user, token: "test-token" });
      case "GET /user":
        return json({ user, organizations: [org] });
      case "GET /organizations":
        return json([org]);
      case "GET /organizations/1/dashboard":
        return json(dashboard);
      case "GET /organizations/1/realtime-token":
        return route.fulfill({ status: 204 });
      case "GET /organizations/1/categories":
        return json([]);
      case "GET /organizations/1/transactions":
        return json({ data: dashboard.recent_transactions, meta: { current_page: 1, last_page: 1, per_page: 20, total: 2 } });
      default:
        return json({ message: `unmocked ${key}` }, 404);
    }
  });
}
