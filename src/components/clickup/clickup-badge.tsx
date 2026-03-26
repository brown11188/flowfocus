/**
 * ClickUpBadge — tiny badge shown on tasks that were imported from ClickUp.
 * Shows ClickUp logo + optional status. Clicking opens the task in ClickUp.
 */
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  url?: string | null;
  status?: string | null;
  className?: string;
}

export function ClickUpBadge({ url, status, className }: Props) {
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded",
        "bg-[#7B68EE]/10 text-[#7B68EE] dark:text-violet-300",
        url && "hover:bg-[#7B68EE]/20 transition-colors cursor-pointer",
        className
      )}
    >
      <ClickUpMiniLogo />
      {status ? <span className="max-w-[60px] truncate">{status}</span> : <span>ClickUp</span>}
      {url && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
    </span>
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {inner}
      </a>
    );
  }
  return inner;
}

function ClickUpMiniLogo() {
  return (
    <svg viewBox="0 0 16 16" className="w-2.5 h-2.5 flex-shrink-0" fill="none">
      <path d="M2 10.5l2-1.5c1 1.1 2 1.7 4 1.7s3-0.6 4-1.7l2 1.5c-1.4 1.6-3.2 2.4-6 2.4S3.4 12.1 2 10.5z" fill="currentColor"/>
      <path d="M2 5.5l2 1.5c1-1.2 2.5-2 4-2s3 0.8 4 2l2-1.5C12.5 3.8 10.4 2.8 8 2.8S3.5 3.8 2 5.5z" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}
