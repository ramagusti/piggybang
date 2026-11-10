import { BarChart3, Check, MessageCircle, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DemoChat } from "@/components/marketing/DemoChat";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Piggy } from "@/components/piggy/Piggy";
import { InstallButton } from "@/components/shared/InstallButton";
import { shortRp, TIERS, yearlySaving } from "@/lib/plans";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const features = [
    { icon: MessageCircle, title: t("landing.featureWaTitle"), body: t("landing.featureWaBody") },
    { icon: BarChart3, title: t("landing.featureBudgetTitle"), body: t("landing.featureBudgetBody") },
    { icon: Users, title: t("landing.featureTeamTitle"), body: t("landing.featureTeamBody") },
  ];
  const plans = [
    { name: "Free", price: "Rp 0", items: [t("landing.planFree1"), t("landing.planFree2"), t("landing.planFree3")], cta: t("landing.planFreeCta"), href: "/register", featured: false },
    ...TIERS.map((x) => ({
      name: x.name,
      price: shortRp(x.monthly),
      items: [t("landing.tierYearly", { price: shortRp(x.yearly), pct: yearlySaving(x) }), t("landing.tierBot", { count: x.botReplies }), t("landing.planPro2"), t("landing.planPro3")],
      cta: t("landing.planProCta"),
      href: "/register",
      featured: x.key === "plus",
    })),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" aria-label="Piggybang">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <InstallButton />
            <Button variant="ghost" asChild>
              <Link href="/login">{t("auth.login")}</Link>
            </Button>
            <Button asChild>
              <Link href="/register">{t("auth.register")}</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:px-8 md:py-20">
          <div className="flex flex-col items-center gap-5 text-center md:items-start md:text-left">
            <Piggy state="wave" size={96} />
            <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-5xl">{t("landing.heroTitle")}</h1>
            <p className="max-w-lg text-lg text-muted-foreground">{t("landing.heroSubtitle")}</p>
            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              <Button size="lg" asChild>
                <Link href="/register">{t("landing.ctaPrimary")}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#demo">{t("landing.ctaDemo")}</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t("landing.noCard")}</p>
          </div>
          <div id="demo">
            <DemoChat />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card-hover rounded-xl border bg-surface p-5 shadow-sm">
                <span className="grid size-11 place-items-center rounded-lg bg-primary-bg text-primary">
                  <Icon aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <h2 className="mb-8 text-center text-3xl font-bold">{t("landing.pricingTitle")}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-xl border bg-surface p-6 shadow-sm ${p.featured ? "border-primary ring-2 ring-primary" : ""}`}>
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{p.name}</h3>
                <p className="mt-2 text-2xl font-bold">{p.price}</p>
                <p className="text-sm text-muted-foreground">{t("landing.perMonth")}</p>
                <ul className="my-5 flex-1 space-y-2">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Check className="size-4 shrink-0 text-success" aria-hidden /> {i}
                    </li>
                  ))}
                </ul>
                <Button variant={p.featured ? "default" : "outline"} asChild>
                  {p.href.startsWith("mailto") ? <a href={p.href}>{p.cta}</a> : <Link href={p.href}>{p.cta}</Link>}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <Piggy state="wave" size={48} />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Piggybang · {t("landing.madeIn")}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href="#pricing" className="hover:underline">
              {t("landing.pricingTitle")}
            </a>
            <Link href="/login" className="hover:underline">
              {t("auth.login")}
            </Link>
            <LanguageSwitcher withLabel />
          </div>
        </div>
      </footer>
    </div>
  );
}
