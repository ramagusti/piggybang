"use client";
import { ErrorState } from "@/components/shared/ErrorBoundary";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="grid min-h-[60vh] place-items-center">
      <ErrorState onRetry={reset} />
    </main>
  );
}
