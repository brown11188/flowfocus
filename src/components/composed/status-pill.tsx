import { cn } from "@/lib/utils";

const VARIANT_COLORS: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

const DOT_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  gray: "bg-gray-400",
  violet: "bg-violet-500",
  blue: "bg-blue-500",
};

interface StatusPillProps {
  label: string;
  variant: "green" | "red" | "amber" | "gray" | "violet" | "blue";
  dot?: boolean;
  className?: string;
}

export function StatusPill({ label, variant, dot, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
        VARIANT_COLORS[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full animate-pulse",
            DOT_COLORS[variant],
          )}
        />
      )}
      {label}
    </span>
  );
}
