import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function isToday(date: Date | string): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function isOverdue(date: Date | string): boolean {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDayLabel(date: Date): string {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  if (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  ) return "Today";
  if (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth()
  ) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export const PRIORITY_CONFIG = {
  1: { label: "Urgent", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", border: "border-red-200 dark:border-red-800", flag: "🔴" },
  2: { label: "High", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950", border: "border-orange-200 dark:border-orange-800", flag: "🟠" },
  3: { label: "Medium", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-200 dark:border-blue-800", flag: "🔵" },
  4: { label: "Low", color: "text-gray-400", bg: "bg-gray-50 dark:bg-gray-900", border: "border-gray-200 dark:border-gray-700", flag: "⚪" },
} as const;
