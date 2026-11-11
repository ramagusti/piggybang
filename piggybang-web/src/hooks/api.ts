"use client";
import Cookies from "js-cookie";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type {
  Bill,
  Category,
  Dashboard,
  Member,
  Organization,
  Paginated,
  Permission,
  Rule,
  Savings,
  SavingsCurrent,
  Subscription,
  Transaction,
  TxFilters,
  TxType,
  User,
  WhatsAppConnection,
} from "@/types";

export const queryKeys = {
  me: ["me"] as const,
  organizations: ["organizations"] as const,
  org: (orgId: number) => ["organizations", orgId] as const,
  dashboard: (orgId: number, period: string) => ["organizations", orgId, "dashboard", period] as const,
  members: (orgId: number) => ["organizations", orgId, "members"] as const,
  categories: (orgId: number) => ["organizations", orgId, "categories"] as const,
  transactions: (orgId: number, filters: TxFilters) => ["organizations", orgId, "transactions", filters] as const,
  savings: (orgId: number) => ["organizations", orgId, "savings"] as const,
  savingsHistory: (orgId: number) => ["organizations", orgId, "savings", "history"] as const,
  bills: (orgId: number) => ["organizations", orgId, "bills"] as const,
  rules: (orgId: number) => ["organizations", orgId, "rules"] as const,
  ruleTransactions: (orgId: number, ruleId: number) => ["organizations", orgId, "rules", ruleId, "transactions"] as const,
  subscription: (orgId: number) => ["organizations", orgId, "subscription"] as const,
  whatsapp: (orgId: number) => ["organizations", orgId, "whatsapp"] as const,
  apiTokens: (orgId: number) => ["organizations", orgId, "api-tokens"] as const,
};

const authed = () => !!getToken();

export const useMe = () =>
  useQuery({ queryKey: queryKeys.me, queryFn: () => api<{ user: User; organizations: Organization[] }>("/user"), enabled: authed() });

export const useOrganizations = () =>
  useQuery({ queryKey: queryKeys.organizations, queryFn: () => api<Organization[]>("/organizations"), enabled: authed() });

/** Subdomain slug (set by proxy) wins, then the persisted choice, then the first org. */
export function useCurrentOrg() {
  const { data, isLoading, error, refetch } = useOrganizations();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const orgs = data ?? [];
  const slug = typeof document !== "undefined" ? Cookies.get("pb_org_slug") : undefined;
  const org = orgs.find((o) => o.slug === slug) ?? orgs.find((o) => o.id === currentOrgId) ?? orgs[0];
  return {
    org,
    orgs,
    isLoading,
    error,
    refetch,
    can: (p: Permission) => !!org?.permissions.includes(p),
    isPro: org?.effective_plan === "pro",
  };
}

const orgPath = (orgId: number, path = "") => `/organizations/${orgId}${path}`;

export const useDashboard = (orgId: number, period: string) =>
  useQuery({ queryKey: queryKeys.dashboard(orgId, period), queryFn: () => api<Dashboard>(orgPath(orgId, "/dashboard"), { query: { period } }) });

export const useTransactions = (orgId: number, filters: TxFilters) =>
  useQuery({
    queryKey: queryKeys.transactions(orgId, filters),
    queryFn: () => api<Paginated<Transaction>>(orgPath(orgId, "/transactions"), { query: { ...filters } }),
    placeholderData: (prev) => prev,
  });

export const useCategories = (orgId: number, type?: TxType) =>
  useQuery({
    queryKey: queryKeys.categories(orgId),
    queryFn: () => api<Category[]>(orgPath(orgId, "/categories")),
    select: (cats) => (type ? cats.filter((c) => c.type === type) : cats),
  });

export const useRules = (orgId: number) =>
  useQuery({ queryKey: queryKeys.rules(orgId), queryFn: () => api<Rule[]>(orgPath(orgId, "/rules")) });

/** Expenses counting toward a budget since the start of the payday cycle. */
export const useRuleTransactions = (orgId: number, ruleId: number) =>
  useQuery({
    queryKey: queryKeys.ruleTransactions(orgId, ruleId),
    queryFn: () => api<{ period_start: string; total: string; transactions: Transaction[] }>(orgPath(orgId, `/rules/${ruleId}/transactions`)),
  });

export const useSavings = (orgId: number) =>
  useQuery({ queryKey: queryKeys.savings(orgId), queryFn: () => api<SavingsCurrent>(orgPath(orgId, "/savings")) });

export const useSavingsHistory = (orgId: number) =>
  useQuery({ queryKey: queryKeys.savingsHistory(orgId), queryFn: () => api<Savings[]>(orgPath(orgId, "/savings/history")) });

export const useBills = (orgId: number) =>
  useQuery({ queryKey: queryKeys.bills(orgId), queryFn: () => api<Bill[]>(orgPath(orgId, "/bills")) });

export const useMembers = (orgId: number) =>
  useQuery({ queryKey: queryKeys.members(orgId), queryFn: () => api<Member[]>(orgPath(orgId, "/members")) });

export const useSubscription = (orgId: number, enabled = true) =>
  useQuery({ queryKey: queryKeys.subscription(orgId), queryFn: () => api<Subscription>(orgPath(orgId, "/subscription")), enabled });

export const useWhatsAppConnection = (orgId: number, poll = false) =>
  useQuery({
    queryKey: queryKeys.whatsapp(orgId),
    queryFn: () => api<{ connection: WhatsAppConnection | null; platform_number: string | null }>(orgPath(orgId, "/whatsapp")),
    refetchInterval: poll ? 3000 : false,
  });

export const useApiTokens = (orgId: number, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.apiTokens(orgId),
    queryFn: () => api<{ id: number; name: string; last_used_at?: string | null; created_at?: string }[]>(orgPath(orgId, "/api-tokens")),
    enabled,
  });

/**
 * Any org mutation: on success invalidate the whole org subtree + org list.
 * ponytail: coarse invalidation (one tx touches dashboard, savings, rules, bills); per-key if refetch cost shows up.
 */
export function useOrgMutation<V = void, R = unknown>(orgId: number | undefined, fn: (vars: V) => Promise<R>, opts: { silent?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: queryKeys.org(orgId) });
      qc.invalidateQueries({ queryKey: queryKeys.organizations, exact: true });
    },
    onError: (e: Error) => {
      if (!opts.silent) toast.error(e.message);
    },
  });
}

export { orgPath };
