import { cn } from "@/lib/utils";

type Color = "blue" | "red" | "yellow" | "green" | "violet" | "gray";

const colors: Record<Color, string> = {
  blue:   "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
  red:    "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
  yellow: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300",
  green:  "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300",
  violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
  gray:   "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
};

export function MiniStat({
  label, value, color,
}: { label: string; value: number; color: Color }) {
  return (
    <div className={cn("rounded-xl p-2.5 text-center", colors[color])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs opacity-75 mt-0.5">{label}</p>
    </div>
  );
}
