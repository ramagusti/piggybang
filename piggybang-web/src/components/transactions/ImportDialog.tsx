"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrgMutation } from "@/hooks/api";
import { api } from "@/lib/api";

interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

export function ImportDialog({ orgId, open, onOpenChange }: { orgId: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const upload = useOrgMutation(orgId, (f: File) => {
    const body = new FormData();
    body.append("file", f);
    return api<ImportResult>(`/organizations/${orgId}/transactions/import`, { method: "POST", body });
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setResult(null);
      }}
      title={t("tx.import")}
      description={t("tx.importHint")}
    >
      <code className="block overflow-x-auto rounded-md bg-muted p-2 text-xs">date,type,category,amount,currency,description,actor</code>
      {result ? (
        <div role="status" className="space-y-2">
          <p className="font-medium text-success">{t("tx.imported", { count: result.imported })}</p>
          {result.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-danger">
              {result.errors.map((e) => (
                <li key={e.row}>
                  {t("tx.importRow", { row: e.row })}: {e.message}
                </li>
              ))}
            </ul>
          )}
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            {t("common.done")}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (file) setResult(await upload.mutateAsync(file));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="import-file">{t("tx.csvFile")}</Label>
            <Input id="import-file" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="submit" className="w-full" disabled={!file || upload.isPending}>
            {upload.isPending ? t("common.loading") : t("tx.import")}
          </Button>
        </form>
      )}
    </ResponsiveModal>
  );
}
