"use client";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Piggy, type PiggyState } from "@/components/piggy/Piggy";

export function fireConfetti(big = false) {
  confetti({
    particleCount: big ? 160 : 70,
    spread: big ? 100 : 60,
    origin: { y: 0.7 },
    colors: ["#4F46E5", "#F97316", "#10B981", "#F59E0B", "#818CF8"],
    disableForReducedMotion: true,
  });
}

/** Milestone toast with Piggy (spec §4.2). */
export function celebrate(
  message: string,
  state: PiggyState = "dance",
  big = false,
) {
  if (state === "dance" || state === "celebrate") fireConfetti(big);
  toast(message, { icon: <Piggy state={state} size={28} /> });
}
