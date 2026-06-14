import { cn } from "@/lib/utils";

export function Blob({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn("pointer-events-none absolute", className)}
    >
      <path
        fill="currentColor"
        d="M44.8,-66.8C57.2,-58.3,65.6,-44.2,70.9,-29.4C76.2,-14.6,78.4,0.9,74.6,15C70.8,29.1,61,41.8,48.6,51.5C36.2,61.2,21.1,67.9,4.7,71.7C-11.7,75.6,-29.4,76.6,-43.6,69.6C-57.8,62.6,-68.5,47.6,-73.9,31.1C-79.3,14.6,-79.4,-3.4,-74.2,-19.4C-69,-35.4,-58.5,-49.4,-45.2,-57.7C-31.9,-66,-15.9,-68.6,0.3,-69C16.6,-69.5,33.1,-67.8,44.8,-66.8Z"
        transform="translate(100 100)"
      />
    </svg>
  );
}

export function WaveDivider({
  className,
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("block h-[60px] w-full sm:h-[90px]", flip && "rotate-180", className)}
    >
      <path
        fill="currentColor"
        d="M0,64 C240,120 480,8 720,40 C960,72 1200,128 1440,72 L1440,120 L0,120 Z"
      />
    </svg>
  );
}

export function DottedArc({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={cn("pointer-events-none absolute", className)}
    >
      <g fill="currentColor">
        {Array.from({ length: 9 }).map((_, row) =>
          Array.from({ length: 9 }).map((__, col) => (
            <circle key={`${row}-${col}`} cx={8 + col * 13} cy={8 + row * 13} r="2.4" />
          )),
        )}
      </g>
    </svg>
  );
}
