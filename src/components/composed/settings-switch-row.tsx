"use client";

import { cn } from "@/lib/utils";

interface SettingsSwitchRowProps {
  title: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  badge?: string;
  badgeVariant?: "green" | "red" | "amber" | "gray";
}

const BADGE_COLORS: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function SettingsSwitchRow({
  title,
  description,
  enabled,
  onChange,
  disabled = false,
  badge,
  badgeVariant = "gray",
}: SettingsSwitchRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {title}
          </span>
          {badge && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                BADGE_COLORS[badgeVariant],
              )}
            >
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => !disabled && onChange(!enabled)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
          enabled
            ? "bg-violet-600"
            : "bg-gray-300 dark:bg-gray-600",
          disabled && "pointer-events-none",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
            enabled ? "translate-x-[18px]" : "translate-x-[2px]",
            "mt-[2px]",
          )}
        />
      </button>
    </div>
  );
}
