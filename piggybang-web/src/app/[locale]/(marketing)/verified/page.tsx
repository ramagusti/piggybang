import { getTranslations, setRequestLocale } from "next-intl/server";
import { Piggy } from "@/components/piggy/Piggy";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function VerifiedPage({ params }: PageProps<"/[locale]/verified">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Piggy state="bang" size={120} />
        <h1 className="text-2xl font-bold">{t("auth.verifiedTitle")}</h1>
        <p className="text-muted-foreground">{t("auth.verifiedBody")}</p>
        <Button asChild>
          <Link href="/app/dashboard">{t("auth.continue")}</Link>
        </Button>
      </div>
    </main>
  );
}
