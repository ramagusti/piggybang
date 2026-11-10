"use client";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * PiggyBang! mascot: a piggy bank (coin slot on its head) whose tail is a bomb fuse.
 * - `fuse`: lit fuse, flickering spark (loading).
 * - `bang`: the spark runs down the fuse into the pig → the pig swells → a full-size explosion swallows it
 *   (flash, shockwave, BANG!, smoke, coins everywhere) → the pig pops back, grinning.
 *   Plays once (ends calm, fuse burnt), or `loop` (burn → bang → rest → fuse regrows).
 * Bang uses SMIL (keeps spark, fuse and boom in sync); reduced-motion users get a still pig.
 */
export type PiggyState = "idle" | "wave" | "dance" | "worry" | "thumbsup" | "point" | "celebrate" | "bandage" | "sleep" | "fuse" | "bang";

const PINK = "#F9A8C9";
const PINK_DARK = "#EC6FA5";
const SLOT = "#9D174D";
const INK = "#1E1B4B";
const CORD = "#B45309";

const BODY_ANIM: Partial<Record<PiggyState, string>> = {
  idle: "animate-piggy-bounce",
  dance: "animate-piggy-dance",
  celebrate: "animate-piggy-bounce",
  thumbsup: "animate-piggy-bounce",
};
const UNLIT: PiggyState[] = ["worry", "bandage", "sleep"];

// Fuse from the pig's rear (93,80) curling up to the tip (112,53); SPARK_PATH is the same curve reversed.
const FUSE = "M93 80 C103 80 101 70 107 68 C113 66 115 60 112 53";
const SPARK_PATH = "M112 53 C115 60 113 66 107 68 C101 70 103 80 93 80";
const TIP = { x: 112, y: 53 };

const star = (n: number, outer: number, inner: number, rot = 0) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = (i * Math.PI) / n - Math.PI / 2 + rot;
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
// Explosion centred on the pig and bigger than it (the svg overflows its box on purpose).
const BOOM = { x: 60, y: 66 };
const BURST_OUT = star(14, 76, 46);
const BURST_MID = star(14, 60, 34, 0.22);
const BURST_IN = star(12, 42, 22);
const ring = (n: number, r: number, rot = 0) => Array.from({ length: n }, (_, i) => [Math.round(r * Math.cos((i * 2 * Math.PI) / n + rot)), Math.round(r * Math.sin((i * 2 * Math.PI) / n + rot))] as const);
const COINS = ring(8, 82, 0.3);
const SMOKE = ring(6, 58, 0.9);

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribe = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** false on the server and for reduced-motion users → render the still version. */
const useMotion = () => useSyncExternalStore(subscribe, () => !reduced(), () => false);

/** SMIL timing for one bang, as fractions of dur. b = boom, e = explosion gone / pig back, r = fuse regrows (loop only). */
function timing(loop: boolean) {
  return loop ? { dur: "5.6s", b: 0.26, e: 0.56, r: 0.84, repeat: "indefinite" } : { dur: "2.8s", b: 0.4, e: 0.9, r: 1, repeat: "1" };
}

function Spark() {
  return (
    <g>
      <polygon points={star(8, 6.5, 2.4)} fill="#FDE047" stroke="#F97316" strokeWidth="1" strokeLinejoin="round" className="animate-fuse-spark" />
      <circle r="1.8" fill="#fff" />
      <circle r="1" fill="#FDBA74" className="animate-fuse-ember" style={{ "--dx": "5px", "--dy": "-6px" } as React.CSSProperties} />
      <circle r="0.8" fill="#FDE047" className="animate-fuse-ember" style={{ "--dx": "-6px", "--dy": "-3px", animationDelay: "0.3s" } as React.CSSProperties} />
    </g>
  );
}

function Confetti() {
  const bits = [
    [14, 20, "#4F46E5"],
    [104, 16, "#F97316"],
    [10, 60, "#10B981"],
    [110, 30, "#F59E0B"],
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
  loop = false,
}: {
  state?: PiggyState;
  size?: number;
  className?: string;
  label?: string;
  message?: React.ReactNode;
  /** bang only: repeat (burn → BANG → rest → fuse regrows) instead of playing once. */
  loop?: boolean;
}) {
  const motion = useMotion();
  const banging = state === "bang" && motion;
  const t = timing(loop);
  const kt = (...xs: number[]) => xs.map((x) => +x.toFixed(3)).join(";");
  const eyesClosed = state === "sleep";
  const lit = !UNLIT.includes(state);
  const happy = state === "bang" || state === "celebrate" || state === "dance";
  const anim = { dur: t.dur, repeatCount: t.repeat, fill: "freeze" } as const;
  const gone = t.e - 0.1; // explosion faded, pig pops back
  /** Scale pop for an explosion layer, starting `d` after the boom. */
  const pop = (d = 0, peak = 1.2) => (
    <animateTransform attributeName="transform" type="scale" values={`0;0;${peak};1;1.1;1.1`} keyTimes={kt(0, t.b + d, t.b + d + 0.04, t.b + d + 0.09, gone, 1)} {...anim} />
  );
  const show = (from: number, to: number, max = 1) => (
    <animate attributeName="opacity" values={`0;0;${max};${max};0;0`} keyTimes={kt(0, from, from + 0.01, to - 0.06, to, 1)} {...anim} />
  );

  const svg = (
    <svg
      // Remount when motion flips or the state changes: SMIL timelines start when the <svg> is inserted.
      key={`${state}-${motion}-${loop}`}
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

      {/* fuse tail */}
      <path d={FUSE} fill="none" stroke={CORD} strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={banging ? "100 100" : undefined}>
        {banging && (
          // hidden once burnt: a zero-length dash would still draw its round cap as a dot
          <animate attributeName="opacity" values={loop ? "1;0;1" : "1;0"} keyTimes={loop ? kt(0, t.b, t.r) : kt(0, t.b)} calcMode="discrete" {...anim} />
        )}
        {banging && <animate attributeName="stroke-dashoffset" values={loop ? "0;100;100;0" : "0;100;100"} keyTimes={loop ? kt(0, t.b, t.r, 1) : kt(0, t.b, 1)} {...anim} />}
      </path>
      {!banging && !lit && <circle cx={TIP.x} cy={TIP.y} r="2" fill="#78350F" />}

      {/* pig: swells as the spark arrives, vanishes inside the explosion, pops back */}
      <g transform="translate(60 84)">
        <g>
          {banging && (
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1;1.22;0.5;0.5;1.12;1;1"
              keyTimes={kt(0, t.b - 0.05, t.b + 0.02, t.b + 0.03, gone, gone + 0.05, t.e, 1)}
              {...anim}
            />
          )}
          {banging && <animate attributeName="opacity" values="1;0;1" keyTimes={kt(0, t.b + 0.03, gone)} calcMode="discrete" {...anim} />}
          <g transform="translate(-60 -84)">
            {/* body + legs */}
            <rect x="38" y="96" width="9" height="14" rx="4" fill={PINK_DARK} />
            <rect x="73" y="96" width="9" height="14" rx="4" fill={PINK_DARK} />
            <ellipse cx="60" cy="84" rx="34" ry="24" fill={PINK} />
            {/* ears */}
            <path d="M34 34 L30 12 L50 26 Z" fill={PINK_DARK} />
            <path d="M86 34 L90 12 L70 26 Z" fill={PINK_DARK} />
            {/* head + coin slot */}
            <circle cx="60" cy="50" r="30" fill={PINK} />
            <rect x="51" y="24" width="18" height="4.5" rx="2.25" fill={SLOT} />
            {/* cheeks */}
            <circle cx="40" cy="58" r="5" fill="#FB7185" opacity="0.45" />
            <circle cx="80" cy="58" r="5" fill="#FB7185" opacity="0.45" />
            {/* eyes */}
            {eyesClosed ? (
              <g stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round">
                <path d="M44 46q4 4 8 0" />
                <path d="M68 46q4 4 8 0" />
              </g>
            ) : happy && !banging ? (
              <g stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round">
                <path d="M44 46q4 -5 8 0" />
                <path d="M68 46q4 -5 8 0" />
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
            <ellipse cx="55.5" cy="58" rx="2" ry="3" fill={SLOT} />
            <ellipse cx="64.5" cy="58" rx="2" ry="3" fill={SLOT} />
            {/* mouth */}
            {state === "worry" ? (
              <path d="M53 71q3.5-3 7 0t7 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            ) : state === "sleep" ? (
              <ellipse cx="60" cy="71" rx="2.5" ry="2" fill={INK} />
            ) : happy ? (
              <path d="M52 68q8 9 16 0z" fill={INK} />
            ) : (
              <path d="M53 69q7 6 14 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            )}
            {/* arms / props */}
            {state === "wave" && (
              <g className="animate-piggy-wave">
                <path d="M30 80 L16 58" stroke={PINK} strokeWidth="9" strokeLinecap="round" />
                <circle cx="16" cy="57" r="6" fill={PINK_DARK} />
              </g>
            )}
            {state === "thumbsup" && (
              <g>
                <path d="M30 82 L20 70" stroke={PINK} strokeWidth="9" strokeLinecap="round" />
                <rect x="13" y="58" width="11" height="12" rx="4" fill={PINK_DARK} />
                <rect x="15" y="49" width="5" height="11" rx="2.5" fill={PINK_DARK} />
              </g>
            )}
            {state === "point" && (
              <g>
                <path d="M30 84 L12 80" stroke={PINK} strokeWidth="9" strokeLinecap="round" />
                <path d="M12 80 L2 78" stroke={PINK_DARK} strokeWidth="4" strokeLinecap="round" />
              </g>
            )}
            {state === "worry" && <path d="M30 26q-5 8 0 11 5-3 0-11z" fill="#60A5FA" />}
            {state === "bandage" && (
              <g transform="rotate(-25 70 26)">
                <rect x="58" y="31" width="26" height="10" rx="5" fill="#FCD9B6" stroke="#E7B98F" />
                <circle cx="68" cy="36" r="1" fill="#C08457" />
                <circle cx="74" cy="36" r="1" fill="#C08457" />
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
          </g>
        </g>
      </g>

      {/* spark: still at the tip, or riding the fuse into the pig */}
      {lit && !banging && (
        <g transform={`translate(${TIP.x} ${TIP.y})`}>
          <Spark />
        </g>
      )}
      {banging && (
        <g>
          <animateMotion path={SPARK_PATH} keyPoints={loop ? "0;1;1;0" : "0;1;1"} keyTimes={loop ? kt(0, t.b, t.r, 1) : kt(0, t.b, 1)} calcMode="linear" {...anim} />
          <animate attributeName="opacity" values={loop ? "1;0;1" : "1;0"} keyTimes={loop ? kt(0, t.b, t.r) : kt(0, t.b)} calcMode="discrete" {...anim} />
          <Spark />
        </g>
      )}

      {/* explosion: drawn over the pig, larger than the pig */}
      {banging && (
        <g transform={`translate(${BOOM.x} ${BOOM.y})`}>
          {/* flash */}
          <circle r="88" fill="#FEF08A" opacity="0">
            <animate attributeName="opacity" values="0;0;0.6;0;0" keyTimes={kt(0, t.b, t.b + 0.015, t.b + 0.07, 1)} {...anim} />
          </circle>
          {/* smoke left behind */}
          {SMOKE.map(([dx, dy], i) => (
            <g key={i} opacity="0">
              {show(t.b + 0.08, t.e + 0.02, 0.75)}
              <animateTransform attributeName="transform" type="translate" values={`${dx * 0.4} ${dy * 0.4};${dx * 0.4} ${dy * 0.4};${dx * 1.25} ${dy * 1.25 - 12};${dx * 1.25} ${dy * 1.25 - 12}`} keyTimes={kt(0, t.b + 0.08, t.e + 0.02, 1)} {...anim} />
              <circle r={15 - i} fill="#9CA3AF" />
            </g>
          ))}
          {/* fireball layers */}
          <g opacity="0">
            {show(t.b, gone)}
            <g>
              {pop(0, 1.25)}
              <polygon points={BURST_OUT} fill="#F97316" stroke="#DC2626" strokeWidth="2.5" strokeLinejoin="round" />
            </g>
            <g>
              {pop(0.015, 1.3)}
              <polygon points={BURST_MID} fill="#FB923C" />
            </g>
            <g>
              {pop(0.03, 1.35)}
              <polygon points={BURST_IN} fill="#FDE047" />
              <circle r="15" fill="#fff" />
            </g>
          </g>
          {/* shockwave */}
          <circle r="10" fill="none" stroke="#F97316" strokeWidth="6" opacity="0">
            <animate attributeName="r" values="10;10;105;105" keyTimes={kt(0, t.b, t.b + 0.16, 1)} {...anim} />
            <animate attributeName="stroke-width" values="7;7;0;0" keyTimes={kt(0, t.b, t.b + 0.16, 1)} {...anim} />
            <animate attributeName="opacity" values="0;0;0.9;0;0" keyTimes={kt(0, t.b, t.b + 0.01, t.b + 0.16, 1)} {...anim} />
          </circle>
          {/* coins blown out in every direction */}
          {COINS.map(([dx, dy], i) => (
            <g key={i} opacity="0">
              <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={kt(0, t.b + 0.01, t.b + 0.02, gone - 0.08, gone, 1)} {...anim} />
              <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;${dx} ${dy};${dx * 1.08} ${dy * 1.08 + 10};${dx * 1.08} ${dy * 1.08 + 10}`} keyTimes={kt(0, t.b + 0.01, t.b + 0.14, gone, 1)} calcMode="spline" keySplines="0 0 1 1;0.1 0.8 0.3 1;0 0 1 1;0 0 1 1" {...anim} />
              <circle r="6" fill="#FBBF24" stroke="#B45309" strokeWidth="1.4" />
              <path d="M0 -3v6" stroke="#B45309" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          ))}
          {/* BANG! */}
          <g opacity="0">
            {show(t.b + 0.02, gone)}
            <g>
              {pop(0.02, 1.4)}
              <text transform="rotate(-10)" y="2" textAnchor="middle" dominantBaseline="middle" fontSize="34" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#DC2626" stroke="#fff" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round" letterSpacing="0.5">
                BANG!
              </text>
            </g>
          </g>
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
