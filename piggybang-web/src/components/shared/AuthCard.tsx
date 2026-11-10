import { Logo } from "@/components/shared/Logo";
import { Link } from "@/i18n/navigation";

/** Auth pages: clean, no Piggy (spec §3.2). */
export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex justify-center"
          aria-label="PiggyBang!"
        >
          <Logo />
        </Link>
        <div className="rounded-xl border bg-surface p-6 shadow-md">
          <h1 className="mb-5 text-xl font-bold">{title}</h1>
          {children}
        </div>
        {footer && (
          <div className="mt-5 space-y-1 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  );
}
