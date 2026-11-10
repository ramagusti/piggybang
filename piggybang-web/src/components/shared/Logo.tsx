import { cn } from "@/lib/utils";

/**
 * PiggyBang! mark: side-view piggy bank whose tail is a lit bomb fuse. Transparent background.
 * Same geometry as src/app/icon.svg (favicon + PWA icons are generated from that file).
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="6.5 1.5 60 60" className={cn("size-9 shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g transform="translate(1 3)">
        <rect x="18" y="41" width="6" height="11" rx="2.5" fill="#EC6FA5" />
        <rect x="35" y="41" width="6" height="11" rx="2.5" fill="#EC6FA5" />
        <ellipse cx="30" cy="34" rx="20" ry="15" fill="#F9A8C9" />
        <path d="M21 24 L17 12 L29 20 Z" fill="#EC6FA5" />
        <rect x="27" y="20.2" width="11" height="3.2" rx="1.6" fill="#9D174D" />
        <ellipse cx="11" cy="35" rx="4.5" ry="5.5" fill="#EC6FA5" />
        <circle cx="10" cy="33.2" r="1" fill="#9D174D" />
        <circle cx="10" cy="36.8" r="1" fill="#9D174D" />
        <circle cx="19" cy="29" r="2.2" fill="#1E1B4B" />
        <circle cx="19.7" cy="28.3" r="0.7" fill="#fff" />
        <circle cx="21" cy="36" r="2.6" fill="#FB7185" opacity="0.45" />
        <path d="M49 31 C55 31 54 24 57 21 S61 15 59 12" fill="none" stroke="#B45309" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M49 31 C55 31 54 24 57 21 S61 15 59 12" fill="none" stroke="#FDE68A" strokeWidth="2.6" strokeDasharray="1.2 2.2" opacity="0.55" />
        <g transform="translate(59 11)">
          <polygon
            points="0,-6 1.5,-1.9 4.2,-4.2 2.1,-0.6 6,0 2.1,0.6 4.2,4.2 1.5,1.9 0,6 -1.5,1.9 -4.2,4.2 -2.1,0.6 -6,0 -2.1,-0.6 -4.2,-4.2 -1.5,-1.9"
            fill="#FDE047"
            stroke="#F97316"
            strokeWidth="1"
            strokeLinejoin="round"
            className="animate-fuse-spark"
          />
          <circle r="1.6" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

export function Logo({ className, hideText }: { className?: string; hideText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <LogoMark />
      {!hideText && (
        <span className="text-lg font-extrabold tracking-tight">
          PiggyBang<span className="ml-px inline-block -rotate-12 text-orange-500">!</span>
        </span>
      )}
    </span>
  );
}
