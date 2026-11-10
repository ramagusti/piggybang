"use client";
import { useOrg } from "@/components/layout/AppShell";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  const { org } = useOrg();
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-10">
      <OnboardingWizard org={org} />
    </main>
  );
}
