"use client";
import { useRef, useState } from "react";
import { Camera, Loader2, Sparkles, Split, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/components/layout/AppShell";
import { AmountInput } from "@/components/shared/AmountInput";
import { CategoryPicker } from "@/components/shared/CategoryPicker";
import { celebrate } from "@/components/shared/DelightAnimation";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import {
  newPart,
  SplitEditor,
  type SplitPart,
} from "@/components/transactions/SplitEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  queryKeys,
  useCategories,
  useMe,
  useMembers,
  useOrgMutation,
} from "@/hooks/api";
import { api } from "@/lib/api";
import { toLocalInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  BudgetWarning,
  Category,
  Dashboard,
  Savings,
  SavingsCurrent,
  Transaction,
  TxType,
} from "@/types";

export interface TxFormValues {
  type: TxType;
  category_id: number;
  amount: number;
  currency: string;
  description: string;
  actor: string;
  transaction_time: string; // ISO
  proof: File | null;
  splits?: { amount: number; category_id: number; actor: string }[]; // split bill: saved as one transaction per part
}

const RECENT_KEY = "pb_recent_cats";
const readRecent = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
};

/** Pure form (tested in isolation). Persistence lives in TransactionDialog. */
export function TransactionForm({
  categories,
  initial,
  defaultActor = "",
  people = [],
  multiCurrency = false,
  onSubmit,
  onCancel,
  onDelete,
  onOcr,
  onCreateCategory,
}: {
  categories: Category[];
  initial?: Transaction;
  defaultActor?: string;
  people?: string[];
  multiCurrency?: boolean;
  onSubmit: (v: TxFormValues) => Promise<unknown>;
  onCancel?: () => void;
  onDelete?: () => void; // editing only
  onOcr?: (file: File) => Promise<{
    amount: number | null;
    description: string | null;
    date: string | null;
  }>;
  onCreateCategory?: (type: TxType, name: string) => Promise<Category>;
}) {
  const t = useTranslations();
  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const [categoryId, setCategoryId] = useState<number | null>(
    initial?.category?.id ?? null,
  );
  const [amount, setAmount] = useState<number | null>(
    initial ? Number(initial.amount) : null,
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "IDR");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [actor, setActor] = useState(initial?.actor ?? defaultActor);
  const [time, setTime] = useState(
    toLocalInput(initial?.transaction_time ?? new Date()),
  );
  const [proof, setProof] = useState<File | null>(null);
  const [ocrState, setOcrState] = useState<"idle" | "reading" | "done">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [parts, setParts] = useState<SplitPart[]>([]);
  const [recent] = useState<number[]>(() =>
    typeof window === "undefined" ? [] : readRecent(),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const ofType = categories.filter((c) => c.type === type);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setProof(file);
    if (!onOcr) return;
    setOcrState("reading");
    try {
      const r = await onOcr(file);
      if (r.amount) setAmount(r.amount);
      if (r.description) setDescription(r.description);
      if (r.date) setTime(toLocalInput(r.date));
      setOcrState("done");
    } catch {
      setOcrState("idle");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!splitOn && !categoryId) errs.category = t("tx.errCategory");
    if (!amount || amount <= 0) errs.amount = t("tx.errAmount");
    if (splitOn) {
      const sum = parts.reduce((s, p) => s + (p.amount ?? 0), 0);
      if (parts.some((p) => !p.amount || !p.categoryId))
        errs.split = t("split.errIncomplete");
      else if (Math.abs(sum - (amount ?? 0)) >= 0.01)
        errs.split = t("split.errTotal");
    }
    if (!time) errs.time = t("tx.errTime");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await onSubmit({
        type,
        category_id: splitOn ? parts[0].categoryId! : categoryId!,
        splits: splitOn
          ? parts.map((p) => ({
              amount: p.amount!,
              category_id: p.categoryId!,
              actor: p.actor,
            }))
          : undefined,
        amount: amount!,
        currency,
        description,
        actor,
        transaction_time: new Date(time).toISOString(),
        proof,
      });
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify(
          [categoryId, ...recent.filter((r) => r !== categoryId)].slice(0, 3),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t("tx.type")}</legend>
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          role="radiogroup"
        >
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={type === k}
              onClick={() => {
                setType(k);
                setCategoryId(null);
              }}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
                type === k
                  ? k === "expense"
                    ? "bg-surface text-danger shadow-sm"
                    : "bg-surface text-success shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  k === "expense" ? "bg-danger" : "bg-success",
                )}
                aria-hidden
              />
              {t(`tx.${k}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {!splitOn && (
        <div className="space-y-1.5">
          <Label htmlFor="tx-category">{t("tx.category")}</Label>
          <CategoryPicker
            id="tx-category"
            categories={ofType}
            value={categoryId}
            onChange={setCategoryId}
            recentIds={recent}
            invalid={!!errors.category}
            onCreate={
              onCreateCategory
                ? async (name) =>
                    setCategoryId((await onCreateCategory(type, name)).id)
                : undefined
            }
          />
          {recent.length > 0 && (
            <p className="text-xs text-muted-foreground">
              ⚡ {t("category.recent")}:{" "}
              {recent
                .map((id) => ofType.find((c) => c.id === id)?.name)
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          )}
          {errors.category && (
            <p className="text-sm text-danger">{errors.category}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tx-amount">{t("tx.amount")}</Label>
        <div className="flex gap-2">
          <AmountInput
            id="tx-amount"
            className="flex-1"
            calculator
            value={amount}
            onChange={setAmount}
            prefix={currency === "IDR" ? "Rp" : currency}
            invalid={!!errors.amount}
            aria-describedby="tx-amount-err"
          />
          {multiCurrency && (
            <Input
              aria-label={t("tx.currency")}
              className="w-20 uppercase"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          )}
        </div>
        {errors.amount && (
          <p id="tx-amount-err" className="text-sm text-danger">
            {errors.amount}
          </p>
        )}
      </div>

      {!initial && (
        <div className="space-y-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor="tx-split" className="flex items-center gap-2">
              <Split className="size-4 text-muted-foreground" aria-hidden />{" "}
              {t("split.toggle")}
            </Label>
            <Switch
              id="tx-split"
              checked={splitOn}
              onCheckedChange={(on) => {
                setSplitOn(on);
                if (on && parts.length === 0)
                  setParts([
                    newPart({ categoryId, actor }),
                    newPart({ categoryId }),
                  ]);
              }}
            />
          </div>
          {splitOn && (
            <SplitEditor
              total={amount}
              parts={parts}
              onChange={setParts}
              categories={ofType}
              people={people}
            />
          )}
          {errors.split && (
            <p className="text-sm text-danger">{errors.split}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="tx-desc">{t("tx.description")}</Label>
        <Input
          id="tx-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!splitOn && (
          <div className="space-y-1.5">
            <Label htmlFor="tx-actor">{t("tx.actor")}</Label>
            <Input
              id="tx-actor"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="tx-time">{t("tx.date")}</Label>
          <Input
            id="tx-time"
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-invalid={!!errors.time || undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">{t("tx.proof")}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label={t("tx.proof")}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-dashed border-border-strong px-4 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          {ocrState === "reading" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Camera className="size-5" aria-hidden />
          )}
          <span className="flex-1">
            {proof ? proof.name : t("tx.proofHint")}
          </span>
        </button>
        {ocrState === "done" && (
          <p
            role="status"
            className="flex items-center gap-1 text-sm text-primary"
          >
            <Sparkles className="size-4" aria-hidden /> {t("tx.ocrDone")}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-danger hover:text-danger"
            onClick={onDelete}
          >
            <Trash2 aria-hidden /> {t("common.delete")}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {t("tx.save")}
        </Button>
      </div>
    </form>
  );
}

interface CreateResponse {
  transaction?: Transaction;
  transactions?: Transaction[]; // split bill
  metadata?: { budget_warnings?: BudgetWarning[]; savings?: Savings };
}

/** Modal (desktop) / sheet (mobile) wired to the API, with milestone delight. */
export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction?: Transaction;
  onDelete?: (tx: Transaction) => void;
}) {
  const t = useTranslations();
  const { org, isPro, can } = useOrg();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(org.id);
  const { data: me } = useMe();
  const { data: members = [] } = useMembers(org.id);
  const people = members.flatMap((m) => (m.user ? [m.user.name] : []));
  const base = `/organizations/${org.id}/transactions`;

  const save = useOrgMutation(org.id, ({ splits, ...v }: TxFormValues) => {
    const body = new FormData();
    for (const [k, val] of Object.entries(v))
      if (val !== null && val !== "")
        body.append(k, val instanceof File ? val : String(val));
    splits?.forEach((s, i) => {
      body.append(`splits[${i}][amount]`, String(s.amount));
      body.append(`splits[${i}][category_id]`, String(s.category_id));
      if (s.actor) body.append(`splits[${i}][actor]`, s.actor);
    });
    if (transaction) body.append("_method", "PATCH");
    return api<CreateResponse>(
      transaction
        ? `${base}/${transaction.id}`
        : splits
          ? `${base}/split`
          : base,
      { method: "POST", body },
    );
  });

  async function onSubmit(v: TxFormValues) {
    // Snapshot before invalidation for milestone checks.
    const dash = qc.getQueriesData<Dashboard>({
      queryKey: ["organizations", org.id, "dashboard"],
    })[0]?.[1];
    const prevSavings = qc.getQueryData<SavingsCurrent>(
      queryKeys.savings(org.id),
    );
    const res = await save.mutateAsync(v);
    onOpenChange(false);
    if (transaction) return;
    const total =
      (dash?.transactions_total ?? -1) + (res?.transactions?.length ?? 1);
    const exceeded = res?.metadata?.budget_warnings?.find(
      (w) => w.level === "exceeded",
    );
    const net = Number(res?.metadata?.savings?.net_savings ?? NaN);
    if (total === 1) celebrate(t("delight.firstTx"), "dance", true);
    else if (total === 100)
      celebrate(t("delight.hundredTx"), "bang", true);
    else if (prevSavings && Number(prevSavings.net_savings) <= 0 && net > 0)
      celebrate(t("delight.savingsPositive"), "bang", true);
    else if (exceeded)
      celebrate(t("delight.budgetExceeded", { cat: exceeded.name }), "worry");
    else celebrate(t("tx.saved"), "thumbsup");
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={transaction ? t("tx.edit") : t("tx.new")}
    >
      <TransactionForm
        key={transaction?.id ?? "new"}
        categories={categories}
        initial={transaction}
        defaultActor={me?.user.name ?? ""}
        people={people}
        multiCurrency={isPro}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
        onDelete={
          transaction && onDelete
            ? () => {
                onOpenChange(false);
                onDelete(transaction);
              }
            : undefined
        }
        onOcr={async (file) => {
          const body = new FormData();
          body.append("image", file);
          return api(`/organizations/${org.id}/ocr/receipt`, {
            method: "POST",
            body,
          });
        }}
        onCreateCategory={
          can("categories.write")
            ? async (type, name) => {
                const cat = await api<Category>(
                  `/organizations/${org.id}/categories`,
                  { method: "POST", body: { type, name } },
                );
                await qc.invalidateQueries({
                  queryKey: queryKeys.categories(org.id),
                });
                return cat;
              }
            : undefined
        }
      />
    </ResponsiveModal>
  );
}
