import { useTranslations } from "next-intl";

/** WhatsApp-style demo; bubbles reveal via CSS animation delays (no JS). */
export function DemoChat() {
  const t = useTranslations();
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border bg-[#E7F0E4] p-4 shadow-lg dark:bg-[#0B141A]" aria-label={t("landing.demoLabel")} role="img">
      <div className="ml-auto w-fit max-w-[80%] animate-chat-in rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-sm text-[#111B21] shadow-sm dark:bg-[#005C4B] dark:text-white">
        {t("landing.demoUser")}
        <span className="ml-3 text-[10px] text-[#667781] dark:text-white/60">12:30 ✓✓</span>
      </div>
      <div
        className="mt-3 w-fit max-w-[85%] animate-chat-in rounded-xl rounded-tl-sm bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-[#111B21] shadow-sm dark:bg-[#202C33] dark:text-white"
        style={{ animationDelay: "0.9s" }}
      >
        {t("landing.demoBot")}
      </div>
    </div>
  );
}
