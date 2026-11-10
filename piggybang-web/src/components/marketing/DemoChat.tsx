import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Msg {
  from: "user" | "bot";
  text: string;
  time?: string;
  reaction?: string;
}

/** WhatsApp *bold* → <strong>. */
const rich = (text: string) => text.split(/(\*[^*\n]+\*)/g).map((part, i) => (part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i}>{part.slice(1, -1)}</strong> : part));

/** WhatsApp-style demo for one scene in landing.chats; bubbles reveal via CSS animation delays (no JS). */
export function DemoChat({ scene, className }: { scene: string; className?: string }) {
  const t = useTranslations("landing");
  const messages = t.raw(`chats.${scene}.messages`) as Msg[];
  return (
    <div className={cn("w-full max-w-md space-y-3 rounded-2xl border bg-[#E7F0E4] p-4 shadow-lg dark:bg-[#0B141A]", className)} aria-label={t("demoLabel")} role="img">
      {messages.map((m, i) => (
        <div
          key={i}
          style={{ animationDelay: `${i * 0.7}s` }}
          className={cn(
            "relative w-fit animate-chat-in rounded-xl px-3 py-2 text-sm shadow-sm",
            m.from === "user"
              ? "ml-auto max-w-[80%] rounded-tr-sm bg-[#D9FDD3] text-[#111B21] dark:bg-[#005C4B] dark:text-white"
              : "max-w-[88%] rounded-tl-sm bg-white leading-relaxed whitespace-pre-line text-[#111B21] dark:bg-[#202C33] dark:text-white",
            m.reaction && "mb-4",
          )}
        >
          {rich(m.text)}
          {m.from === "user" && <span className="ml-3 text-[10px] text-[#667781] dark:text-white/60">{m.time ?? "12:30"} ✓</span>}
          {m.reaction && (
            <span className="absolute -bottom-3.5 right-2 rounded-full border bg-white px-1.5 py-0.5 text-xs shadow-sm dark:border-white/10 dark:bg-[#202C33]">{m.reaction}</span>
          )}
        </div>
      ))}
    </div>
  );
}
