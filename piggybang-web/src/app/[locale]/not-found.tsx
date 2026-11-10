import { getTranslations } from "next-intl/server";
import { Piggy } from "@/components/piggy/Piggy";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Piggy state="sleep" size={120} />
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-muted-foreground">{t("errors.notFound")}</p>
        <Button asChild>
          <Link href="/">{t("errors.backHome")}</Link>
        </Button>
      </div>
    </main>
  );
}
