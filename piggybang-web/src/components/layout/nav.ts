import { FolderOpen, LayoutDashboard, MessageCircle, PiggyBank, ReceiptText, Settings, Target, Users, Wallet } from "lucide-react";

export const NAV = [
  { key: "dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { key: "transactions", href: "/app/transactions", icon: Wallet },
  { key: "categories", href: "/app/categories", icon: FolderOpen },
  { key: "budgets", href: "/app/budgets", icon: Target },
  { key: "bills", href: "/app/bills", icon: ReceiptText },
  { key: "savings", href: "/app/savings", icon: PiggyBank },
  { key: "team", href: "/app/team", icon: Users },
  { key: "whatsapp", href: "/app/whatsapp", icon: MessageCircle },
  { key: "settings", href: "/app/settings", icon: Settings },
] as const;

export const TAB_BAR = ["dashboard", "transactions", "categories", "bills"] as const;
