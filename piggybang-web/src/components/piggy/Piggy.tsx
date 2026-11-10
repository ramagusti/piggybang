import { cn } from "@/lib/utils";

export type PiggyState = "idle" | "wave" | "dance" | "worry" | "thumbsup" | "point" | "celebrate" | "bandage" | "sleep";

const PINK = "#F9A8C9";
const PINK_DARK = "#EC6FA5";
const INK = "#1E1B4B";

const BODY_ANIM: Partial<Record<PiggyState, string>> = {
  idle: "animate-piggy-bounce",
  dance: "animate-piggy-dance",
  celebrate: "animate-piggy-bounce",
  thumbsup: "animate-piggy-bounce",
};

function Confetti() {
  const bits = [
    [14, 20, "#4F46E5"],
    [104, 16, "#F97316"],
    [10, 60, "#10B981"],
    [110, 52, "#F59E0B"],
    [24, 8, "#EF4444"],
    [96, 6, "#818CF8"],
  ] as const;
  return (
    <g>
      {bits.map(([x, y, c], i) => (
        <rect key={i} x={x} y={y} width="5" height="8" rx="1" fill={c} transform={`rotate(${i * 37} ${x} ${y})`} />
      ))}
    </g>
  );
}

/** Original flat pig mascot. Decorative unless `label` is given. */
export function Piggy({
  state = "idle",
  size = 96,
  className,
  label,
  message,
}: {
  state?: PiggyState;
  size?: number;
  className?: string;
  label?: string;
  message?: React.ReactNode;
}) {
  const eyesClosed = state === "sleep";
  const svg = (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 overflow-visible", BODY_ANIM[state], className)}
      data-state={state}
    >
      {(state === "dance" || state === "celebrate") && <Confetti />}
      {/* tail */}
      <path d="M92 84c8 0 10-8 4-9s-4 7 2 6" fill="none" stroke={PINK_DARK} strokeWidth="3" strokeLinecap="round" />
      {/* body + legs */}
      <rect x="38" y="96" width="9" height="14" rx="4" fill={PINK_DARK} />
      <rect x="73" y="96" width="9" height="14" rx="4" fill={PINK_DARK} />
      <ellipse cx="60" cy="84" rx="34" ry="24" fill={PINK} />
      {/* ears */}
      <path d="M34 34 L30 12 L50 26 Z" fill={PINK_DARK} />
      <path d="M86 34 L90 12 L70 26 Z" fill={PINK_DARK} />
      {/* head */}
      <circle cx="60" cy="50" r="30" fill={PINK} />
      {/* cheeks */}
      <circle cx="40" cy="58" r="5" fill="#FB7185" opacity="0.45" />
      <circle cx="80" cy="58" r="5" fill="#FB7185" opacity="0.45" />
      {/* eyes */}
      {eyesClosed ? (
        <g stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M44 46q4 4 8 0" />
          <path d="M68 46q4 4 8 0" />
        </g>
      ) : (
        <g fill={INK}>
          <circle cx="48" cy="45" r="3.5" />
          <circle cx="72" cy="45" r="3.5" />
          <circle cx="49" cy="44" r="1" fill="#fff" />
          <circle cx="73" cy="44" r="1" fill="#fff" />
        </g>
      )}
      {state === "worry" && (
        <g stroke={INK} strokeWidth="2" strokeLinecap="round">
          <path d="M43 37l8 3" />
          <path d="M77 37l-8 3" />
        </g>
      )}
      {/* snout */}
      <ellipse cx="60" cy="58" rx="12" ry="8.5" fill={PINK_DARK} />
      <ellipse cx="55.5" cy="58" rx="2" ry="3" fill="#9D174D" />
      <ellipse cx="64.5" cy="58" rx="2" ry="3" fill="#9D174D" />
      {/* mouth */}
      {state === "worry" ? (
        <path d="M53 71q3.5-3 7 0t7 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      ) : state === "sleep" ? (
        <ellipse cx="60" cy="71" rx="2.5" ry="2" fill={INK} />
      ) : (
        <path d="M53 69q7 6 14 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      )}
      {/* arms / props */}
      {state === "wave" && (
        <g className="animate-piggy-wave">
          <path d="M90 80 L104 58" stroke={PINK} strokeWidth="9" strokeLinecap="round" />
          <circle cx="104" cy="57" r="6" fill={PINK_DARK} />
        </g>
      )}
      {state === "thumbsup" && (
        <g>
          <path d="M90 82 L100 70" stroke={PINK} strokeWidth="9" strokeLinecap="round" />
          <rect x="96" y="58" width="11" height="12" rx="4" fill={PINK_DARK} />
          <rect x="100" y="49" width="5" height="11" rx="2.5" fill={PINK_DARK} />
        </g>
      )}
      {state === "point" && (
        <g>
          <path d="M90 84 L108 80" stroke={PINK} strokeWidth="9" strokeLinecap="round" />
          <path d="M108 80 L118 78" stroke={PINK_DARK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {state === "worry" && <path d="M90 26q-5 8 0 11 5-3 0-11z" fill="#60A5FA" />}
      {state === "celebrate" && (
        <g>
          <path d="M60 4 L48 26 L72 26 Z" fill="#4F46E5" />
          <circle cx="60" cy="4" r="3.5" fill="#F59E0B" />
          <path d="M52 20h16" stroke="#F59E0B" strokeWidth="2.5" />
        </g>
      )}
      {state === "bandage" && (
        <g transform="rotate(-25 70 26)">
          <rect x="58" y="21" width="26" height="10" rx="5" fill="#FCD9B6" stroke="#E7B98F" />
          <circle cx="68" cy="26" r="1" fill="#C08457" />
          <circle cx="74" cy="26" r="1" fill="#C08457" />
        </g>
      )}
      {state === "sleep" && (
        <g fill={INK} fontWeight="700" fontFamily="sans-serif">
          <text x="88" y="24" fontSize="12" className="animate-piggy-zzz">
            Z
          </text>
          <text x="98" y="12" fontSize="9" className="animate-piggy-zzz" style={{ animationDelay: "0.6s" }}>
            z
          </text>
        </g>
      )}
    </svg>
  );

  if (!message) return svg;
  return (
    <div className="flex items-end gap-2">
      {svg}
      <div role="status" className="relative mb-6 rounded-2xl rounded-bl-sm border bg-surface px-3 py-2 text-sm shadow-md">
        {message}
      </div>
    </div>
  );
}
