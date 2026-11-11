// Mirrors /API_CONTRACT.md
export type Role = "owner" | "admin" | "member" | "viewer";
export type Permission =
  | "transactions.view"
  | "transactions.write"
  | "categories.write"
  | "rules.write"
  | "bills.write"
  | "members.manage"
  | "whatsapp.manage"
  | "billing.manage"
  | "organization.delete";
export type TxType = "income" | "expense";
export type WhatsAppMode = "byon" | "all_in";

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  locale: "id" | "en";
  timezone: string;
  email_verified_at: string | null;
  tour_status: "completed" | "skipped" | null; // null = in-app tour not finished yet
  tour_step: string | null;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: "free" | "pro";
  effective_plan: "free" | "pro";
  locked: boolean; // extra team without a paid plan
  is_trialing: boolean;
  trial_ends_at: string | null;
  member_limit: number;
  whatsapp_mode: WhatsAppMode | null;
  settings: { timezone?: string; currency?: string; date_format?: string; onboarded?: boolean; webhook_url?: string };
  role: Role;
  permissions: Permission[];
  limits: { categories_per_type: number | null; members: number };
  usage: { members: number; expense_categories: number; income_categories: number };
}

export interface CategoryRef {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface Category extends CategoryRef {
  type: TxType;
  sort_order: number;
  is_system: boolean;
  transactions_count: number;
}

export interface Transaction {
  id: number;
  type: TxType;
  amount: string;
  currency: string;
  description: string | null;
  actor: string | null;
  transaction_time: string;
  category: CategoryRef | null;
  user: { id: number; name: string } | null;
  proof_url: string | null;
  source: "web" | "whatsapp" | "api" | "import";
  confidence: number | null;
  split: { group: string; part: number; of: number; total: number } | null;
  created_at: string;
}

export type RuleType = "weekly_limit" | "monthly_limit" | "payday";
export interface Rule {
  id: number;
  name: string;
  type: RuleType;
  category_id: number | null;
  category: CategoryRef | null;
  limit_amount: string;
  period: string | null;
  is_primary_payday: boolean;
  date_condition: string | null;
  category_name: string | null;
  rollover_enabled: boolean;
  notify: boolean;
  ai_assign: boolean;
  progress?: {
    period_start: string;
    period_end: string;
    spent: string;
    base_limit: string;
    carryover: string;
    effective_limit: string;
    remaining: string;
    percent: number;
  };
  cycle?: { start: string; end: string };
}

export interface Savings {
  cycle_start: string;
  cycle_end: string;
  income_total: string;
  expense_total: string;
  net_savings: string;
}
export interface SavingsCurrent extends Savings {
  previous_net: string | null;
  trend: "improving" | "worsening" | "flat";
  progress_pct: number;
}

export type BillStatus = "overdue" | "due_soon" | "upcoming" | "normal" | "paid";
export interface Bill {
  id: number;
  name: string;
  amount: string;
  currency: string;
  due_date: string;
  recurrence: "monthly" | "quarterly" | "yearly" | "one_time";
  category_id: number | null;
  category: { id: number; name: string; icon: string | null; color: string | null } | null;
  created_by: { id: number; name: string } | null; // who added it; null for bills older than this field
  destination_account: string | null;
  destination_number: string | null;
  is_active: boolean;
  last_paid_at: string | null;
  days_until_due: number;
  status: BillStatus;
}

export interface Member {
  id: number;
  user: { id: number; name: string; email: string; avatar_url: string | null } | null;
  email: string;
  role: Role;
  pending: boolean;
  joined_at: string;
  invitation_accepted_at: string | null;
}

export interface BudgetWarning {
  rule_id: number;
  name: string;
  spent: string;
  effective_limit: string;
  remaining: string;
  percent: number;
  level: "near" | "exceeded";
}

export interface Dashboard {
  kpi: {
    savings: string;
    income: string;
    expense: string;
    income_change_pct: number | null;
    expense_change_pct: number | null;
    savings_progress_pct: number;
  };
  recent_transactions: Transaction[];
  budget_warnings: BudgetWarning[];
  upcoming_bills: Bill[];
  expense_by_category: { category_id: number; name: string; color: string | null; total: string }[];
  transactions_total: number;
}

export interface WhatsAppConnection {
  mode: WhatsAppMode;
  phone_number: string | null;
  status: "pending" | "verifying" | "connected" | "disconnected" | "error";
  connected_at: string | null;
  monthly_conversations: number;
  conversation_limit: number | null;
  linked_senders: string[];
}

export interface Subscription {
  plan: "free" | "pro";
  effective_plan: "free" | "pro";
  status: string | null;
  provider: "xendit" | "stripe" | null;
  interval: "monthly" | "yearly" | null;
  extra_seats: number;
  tier: "pro" | "plus" | "max" | "trial" | null;
  bot_quota: number;
  bot_used: number;
  bot_packs: number;
  deferred_addon_total: number; // pro rata add-on charges joining the next invoice
  whatsapp_mode: WhatsAppMode | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  monthly_total: string;
  invoices: { date: string; description: string; amount: string; status: string; url: string | null }[];
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface TxFilters {
  type?: TxType;
  category_id?: number;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}
