"use client";
import { cn, getHealthLabel } from "@/lib/utils";

const HEALTH_STYLES = {
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
  yellow: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
} as const;

export function HealthBadge({ status, score, compact = false }: { status: "green" | "yellow" | "red"; score?: number; compact?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-medium",
      compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      HEALTH_STYLES[status]
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "green" ? "bg-green-500" : status === "yellow" ? "bg-amber-500" : "bg-red-500")} />
      {getHealthLabel(score ?? (status === "green" ? 100 : status === "yellow" ? 60 : 25))}
      {score !== undefined && <span className="opacity-70">{score}</span>}
    </span>
  );
}
