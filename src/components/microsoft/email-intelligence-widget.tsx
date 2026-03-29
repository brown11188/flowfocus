"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import {
  Mail, RefreshCw, AlertCircle, Clock, RotateCcw,
  ExternalLink, ChevronDown, ChevronUp, Sparkles,
  MailOpen, CheckCircle2, ShieldAlert,
  Tag, Building2, Globe, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailDigestItem {
  id: string;
  microsoftId: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  receivedAt: string;
  webLink: string | null;
  clientLabel: string | null;
  urgency: "high" | "medium" | "low" | null;
  aiReason: string | null;
  isRead: boolean;
  daysAgo: number;
}

interface EmailDigest {
  id: string;
  scanDate: string;
  totalScanned: number;
  clientEmailCount: number;
  missedReplyCount: number;
  needsReplyCount: number;
  followUpCount: number;
  readAgainCount: number;
  missedReplies: EmailDigestItem[];
  needsReply: EmailDigestItem[];
  followUp: EmailDigestItem[];
  readAgain: EmailDigestItem[];
  noReplyFiltered: number;
  aiSummary: string | null;
  status: "pending" | "running" | "done" | "error";
  errorMessage: string | null;
  completedAt: string | null;
}

interface EmailConnection {
  id: string;
  email: string | null;
  displayName: string | null;
  lastEmailSyncAt: string | null;
}

const URGENCY_CONFIG = {
  high: { color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
  medium: { color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-400" },
  low: { color: "text-gray-400", bg: "bg-gray-50 dark:bg-gray-900", border: "border-gray-100 dark:border-gray-800", dot: "bg-gray-300" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Filter out actioned items from a list */
function withoutActioned(items: EmailDigestItem[], actioned: Set<string>): EmailDigestItem[] {
  return items.filter(i => !actioned.has(i.microsoftId));
}

/** Count how many actioned ids exist in a given list */
function countActioned(items: EmailDigestItem[], actioned: Set<string>): number {
  return items.filter(i => actioned.has(i.microsoftId)).length;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function EmailItemCard({
  item, urgency, onDone, onCreateTask, onUndo,
}: {
  item: EmailDigestItem;
  urgency: "high" | "medium" | "low";
  onDone: (id: string, subject: string | null) => void;
  onCreateTask: (item: EmailDigestItem) => void;
  onUndo?: undefined;
}) {
  const uc = URGENCY_CONFIG[urgency];
  const initials = (item.fromName ?? item.fromEmail ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className={cn("rounded-xl border p-3 text-sm transition-all", uc.bg, uc.border)}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white mt-0.5",
          urgency === "high" ? "bg-red-500" : urgency === "medium" ? "bg-amber-500" : "bg-gray-400"
        )}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug text-gray-900 dark:text-white">
            {item.subject ?? "(no subject)"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {item.fromName ?? item.fromEmail ?? "Unknown"}
            {item.clientLabel && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                <Tag className="w-2.5 h-2.5" />{item.clientLabel}
              </span>
            )}
          </p>
          {item.aiReason && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-start gap-1">
              <Sparkles className="w-2.5 h-2.5 text-violet-400 flex-shrink-0 mt-0.5" />
              <span className="italic truncate">{item.aiReason}</span>
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-[10px] font-medium", uc.color)}>
              {urgency === "high" ? "🔴 Urgent" : urgency === "medium" ? "🟡 Normal" : "⚪ Low"}
            </span>
            <span className="text-[10px] text-gray-400">
              {item.daysAgo === 0 ? "Today" : item.daysAgo === 1 ? "Yesterday" : `${item.daysAgo}d ago`}
            </span>
            {!item.isRead && (
              <span className="text-[10px] font-semibold text-blue-500">Unread</span>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onDone(item.microsoftId, item.subject); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/60 active:scale-95 transition-all min-h-[36px]"
              title="Mark as done — remove from list"
            >
              <Check className="w-4 h-4" /> Done
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onCreateTask(item); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/60 active:scale-95 transition-all min-h-[36px]"
              title="Create task & mark as done"
            >
              <Sparkles className="w-4 h-4" /> +Task
            </button>
            {item.webLink && (
              <a
                href={item.webLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 active:scale-95 transition-all min-h-[36px] ml-auto"
                title="Open in Outlook"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Undo toast bar shown briefly after actioning an email */
function showUndoToast(subject: string | null, onUndo: () => void) {
  toast.success(
    <div className="flex items-center gap-2 min-w-0">
      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
      <span className="truncate text-xs">{subject ?? "Email"} removed</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUndo();
        }}
        className="ml-auto flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors"
      >
        <RotateCcw className="w-3 h-3" /> Undo
      </button>
    </div>,
    { duration: 6000, id: `undo-${Date.now()}` }
  );
}

function CollapsibleSection({
  label, icon: Icon, color, items, defaultOpen = false, totalCount, onDone, onCreateTask,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  items: EmailDigestItem[];
  defaultOpen?: boolean;
  totalCount: number;
  onDone: (id: string, subject: string | null) => void;
  onCreateTask: (item: EmailDigestItem) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (totalCount === 0 && items.length === 0) return null;

  const externalItems = items.filter(i => i.clientLabel !== "Internal");
  const internalItems = items.filter(i => i.clientLabel === "Internal");
  const externalCount = externalItems.length;
  const internalCount = internalItems.length;
  const hasMore = totalCount > items.length;
  const displayTotal = items.length;

  if (displayTotal === 0 && !hasMore) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
      >
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", color)} />
        <span className={cn("text-xs font-semibold", color)}>{label}</span>
        {externalCount > 0 && (
          <span className={cn(
            "ml-1 text-[10px] font-bold px-1.5 py-0 rounded-full",
            color === "text-red-500" ? "bg-red-100 text-red-600 dark:bg-red-900/40" :
            color === "text-amber-500" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40" :
            "bg-blue-100 text-blue-600 dark:bg-blue-900/40"
          )}>
            {externalCount}
          </span>
        )}
        {internalCount > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            +{internalCount} internal
          </span>
        )}
        {hasMore && (
          <span className="text-[9px] text-gray-400 font-normal">
            (showing {displayTotal})
          </span>
        )}
        <span className="flex-1" />
        {open ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 pl-1">
          {externalItems.length > 0 && (
            <div className="space-y-1.5">
              {internalItems.length > 0 && (
                <div className="flex items-center gap-1 text-[9px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">
                  <Globe className="w-2.5 h-2.5" /> External
                </div>
              )}
              {externalItems.map(item => (
                <EmailItemCard key={item.id} item={item} urgency={item.urgency ?? "medium"} onDone={onDone} onCreateTask={onCreateTask} />
              ))}
            </div>
          )}
          {internalItems.length > 0 && (
            <InternalSubSection items={internalItems} onDone={onDone} onCreateTask={onCreateTask} />
          )}
          {hasMore && (
            <div className="text-[10px] text-gray-400 italic text-center py-1">
              … and more. Open full inbox to see all.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InternalSubSection({
  items, onDone, onCreateTask,
}: {
  items: EmailDigestItem[];
  onDone: (id: string, subject: string | null) => void;
  onCreateTask: (item: EmailDigestItem) => void;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Building2 className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Internal (saigontechnology.com)</span>
        <span className="ml-1 text-[9px] font-bold px-1.5 py-0 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
          {items.length}
        </span>
        <span className="flex-1" />
        {open
          ? <ChevronUp className="w-2.5 h-2.5 text-slate-400" />
          : <ChevronDown className="w-2.5 h-2.5 text-slate-400" />}
      </button>
      {open && (
        <div className="p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/40">
          {items.map(item => (
            <EmailItemCard key={item.id} item={item} urgency={item.urgency ?? "medium"} onDone={onDone} onCreateTask={onCreateTask} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────
function StatCard({
  value, internalExtra, label, bg, border, valueColor, subColor,
}: {
  value: number;
  internalExtra: number;
  label: string;
  bg: string;
  border: string;
  valueColor: string;
  subColor: string;
}) {
  return (
    <div className={cn("rounded-lg border p-2 text-center", bg, border)}>
      <div className={cn("text-lg font-bold tabular-nums", valueColor)}>{value}</div>
      <div className={cn("text-[9px] font-medium leading-tight mt-0.5", subColor)}>{label}</div>
      {internalExtra > 0 && (
        <div className="text-[8px] text-slate-400 mt-0.5">+{internalExtra} internal</div>
      )}
    </div>
  );
}

function RulesPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 px-3 py-2">
        <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Bộ lọc email cố định</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80 mt-0.5">
            Hệ thống sẽ tự động exclude email nếu chứa <code className="px-1 rounded bg-amber-100 dark:bg-amber-900/30">no-reply</code>, chứa <code className="px-1 rounded bg-amber-100 dark:bg-amber-900/30">noreply</code>, hoặc có domain <code className="px-1 rounded bg-amber-100 dark:bg-amber-900/30">@saiogntechnology.com</code>.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400">
        Không cần cấu hình rule thủ công nữa.
      </div>
    </div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────────

export function EmailIntelligenceWidget() {
  const [digest, setDigest] = useState<EmailDigest | null>(null);
  const [connection, setConnection] = useState<EmailConnection | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const { timezone } = useTimezoneCtx();

  const loadDigest = useCallback(async () => {
    try {
      const res = await apiFetch("/api/microsoft/email-digest");
      if (!res.ok) return;
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected) {
        setConnection(data.connection);
        setDigest(data.digest);
        if (data.actionedIds) {
          setActionedIds(new Set(data.actionedIds as string[]));
        }
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void loadDigest();
  }, [loadDigest]);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await apiFetch("/api/microsoft/email-scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Reset actioned after new scan (new data replaces old)
        setActionedIds(new Set());
        await loadDigest();
        toast.success("Email scan complete!");
      } else {
        toast.error(data.error ?? "Scan failed");
      }
    } catch {
      toast.error("Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  /** Mark email as actioned — removes from list + updates counts */
  const markActioned = useCallback(async (microsoftEmailId: string, subject: string | null) => {
    // Optimistic: add to actioned set immediately
    setActionedIds(prev => {
      const next = new Set(prev);
      next.add(microsoftEmailId);
      return next;
    });

    const undoAction = () => {
      // Restore to list
      setActionedIds(prev => {
        const next = new Set(prev);
        next.delete(microsoftEmailId);
        return next;
      });
      // Undo on server
      void apiFetch("/api/microsoft/email-actioned", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ microsoftEmailId }),
      }).catch(() => toast.error("Failed to undo"));
    };

    try {
      const res = await apiFetch("/api/microsoft/email-actioned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ microsoftEmailId, subject }),
      });
      if (!res.ok) throw new Error();
      // Show undo toast
      showUndoToast(subject, undoAction);
    } catch {
      // Revert on failure
      setActionedIds(prev => {
        const next = new Set(prev);
        next.delete(microsoftEmailId);
        return next;
      });
      toast.error("Failed to update email status");
    }
  }, []);

  /** Create task from email AND auto-mark as actioned */
  const handleCreateTask = useCallback((item: EmailDigestItem) => {
    // Open quick capture with prefilled text
    window.dispatchEvent(new CustomEvent("quick-capture:open", {
      detail: { text: `Reply to: ${item.subject} (from ${item.fromName || item.fromEmail})` }
    }));
    // Auto-mark as actioned (don't wait for task creation — intent to act is enough)
    void markActioned(item.microsoftId, item.subject);
  }, [markActioned]);

  // ─── Loading ───
  if (connected === null) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Intelligence</span>
        </div>
        <div className="px-4 py-4 flex items-center gap-2 text-sm text-gray-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading...
        </div>
      </div>
    );
  }

  // ─── Not Connected ───
  if (!connected) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Intelligence</span>
        </div>
        <div className="px-4 py-4 text-center space-y-2">
          <MailOpen className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto" />
          <p className="text-xs text-gray-400">Connect your Microsoft account to get AI-powered email insights</p>
          <Link
            href="/microsoft"
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
          >
            Connect Microsoft <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  // ─── Compute visible (non-actioned) items per category ───
  const rawMissed    = digest?.missedReplies ?? [];
  const rawNeeds     = digest?.needsReply ?? [];
  const rawFollow    = digest?.followUp ?? [];
  const rawReadAgain = digest?.readAgain ?? [];

  // Remove actioned items from each list
  const missed    = withoutActioned(rawMissed, actionedIds);
  const needs     = withoutActioned(rawNeeds, actionedIds);
  const follow    = withoutActioned(rawFollow, actionedIds);
  const readAgain = withoutActioned(rawReadAgain, actionedIds);

  // Count how many were actioned per category (for adjusting DB counts)
  const missedActionedCount    = countActioned(rawMissed, actionedIds);
  const needsActionedCount     = countActioned(rawNeeds, actionedIds);
  const followActionedCount    = countActioned(rawFollow, actionedIds);
  const readAgainActionedCount = countActioned(rawReadAgain, actionedIds);

  // Adjusted total counts (DB count minus actioned in that category)
  const missedCount    = Math.max(0, (digest?.missedReplyCount ?? rawMissed.length) - missedActionedCount);
  const needsCount     = Math.max(0, (digest?.needsReplyCount ?? rawNeeds.length) - needsActionedCount);
  const followCount    = Math.max(0, (digest?.followUpCount ?? rawFollow.length) - followActionedCount);
  const readAgainCount = Math.max(0, (digest?.readAgainCount ?? rawReadAgain.length) - readAgainActionedCount);

  // External / Internal split on VISIBLE items only
  const missedExternal    = missed.filter(i => i.clientLabel !== "Internal");
  const needsExternal     = needs.filter(i => i.clientLabel !== "Internal");
  const followExternal    = follow.filter(i => i.clientLabel !== "Internal");
  const readAgainExternal = readAgain.filter(i => i.clientLabel !== "Internal");

  const missedInternal    = missed.filter(i => i.clientLabel === "Internal");
  const needsInternal     = needs.filter(i => i.clientLabel === "Internal");
  const followInternal    = follow.filter(i => i.clientLabel === "Internal");
  const readAgainInternal = readAgain.filter(i => i.clientLabel === "Internal");

  const missedExternalCount    = missedExternal.length;
  const needsExternalCount     = needsExternal.length;
  const followExternalCount    = followExternal.length;
  const readAgainExternalCount = readAgainExternal.length;

  // Internal "extra" count for the stat cards (total adjusted count minus visible external)
  const missedInternalExtra    = Math.max(0, missedCount - missedExternalCount);
  const needsInternalExtra     = Math.max(0, needsCount - needsExternalCount);
  const followInternalExtra    = Math.max(0, followCount - followExternalCount);
  const readAgainInternalExtra = Math.max(0, readAgainCount - readAgainExternalCount);

  const totalExternal = missedExternalCount + needsExternalCount + followExternalCount + readAgainExternalCount;
  const totalInternal = missedInternal.length + needsInternal.length + followInternal.length + readAgainInternal.length;
  const total = missedCount + needsCount + followCount + readAgainCount;

  const isScanned = digest?.status === "done";
  const scanDate = digest?.scanDate;
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const isToday = scanDate === todayKey;

  const lastSync = connection?.lastEmailSyncAt
    ? new Date(connection.lastEmailSyncAt)
    : null;

  const syncLabel = lastSync
    ? isToday
      ? `Today ${lastSync.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })}`
      : lastSync.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: timezone })
    : null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-b border-gray-100 dark:border-gray-800">
        <Mail className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex-1">Email Intelligence</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowRules(s => !s)}
            className={cn(
              "p-1 rounded-lg transition-colors",
              showRules ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
            title="Email exclusion filters"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="p-1 rounded-lg text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
            title="Run email scan now"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isScanning && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Rules panel */}
      {showRules && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <RulesPanel />
        </div>
      )}

      {/* Not scanned yet */}
      {!isScanned && !isScanning && (
        <div className="px-4 py-4 text-center space-y-2">
          {digest?.status === "error" ? (
            <>
              <AlertCircle className="w-7 h-7 text-red-400 mx-auto" />
              <p className="text-xs text-red-500">{digest.errorMessage ?? "Scan failed"}</p>
              <button onClick={handleScan} className="text-xs text-blue-500 hover:underline">Try again</button>
            </>
          ) : (
            <>
              <Mail className="w-7 h-7 text-gray-200 dark:text-gray-700 mx-auto" />
              <p className="text-xs text-gray-400">
                {isToday ? "Scan in progress or ready" : "No scan today yet"}
              </p>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" /> Scan Now
              </button>
            </>
          )}
        </div>
      )}

      {/* Scanning */}
      {isScanning && (
        <div className="px-4 py-4 text-center space-y-2">
          <RefreshCw className="w-7 h-7 text-blue-400 animate-spin mx-auto" />
          <p className="text-xs text-gray-400">AI scanning your inbox...</p>
        </div>
      )}

      {/* Results */}
      {isScanned && !isScanning && (
        <div className="p-3 space-y-3">
          {/* AI Summary */}
          {digest?.aiSummary && (
            <div className="text-xs text-gray-600 dark:text-gray-400 italic border-l-2 border-blue-300 dark:border-blue-700 pl-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/20 rounded-r">
              <Sparkles className="w-2.5 h-2.5 text-blue-400 inline mr-1" />
              {digest.aiSummary}
            </div>
          )}

          {/* Stats row — reflects actioned removals in real time */}
          <div className="grid grid-cols-4 gap-1.5">
            <StatCard value={missedExternalCount} internalExtra={missedInternalExtra} label="Missed" bg="bg-red-50 dark:bg-red-950/20" border="border-red-100 dark:border-red-900" valueColor="text-red-500" subColor="text-red-400" />
            <StatCard value={needsExternalCount} internalExtra={needsInternalExtra} label="Needs Reply" bg="bg-amber-50 dark:bg-amber-950/20" border="border-amber-100 dark:border-amber-900" valueColor="text-amber-500" subColor="text-amber-400" />
            <StatCard value={followExternalCount} internalExtra={followInternalExtra} label="Follow Up" bg="bg-blue-50 dark:bg-blue-950/20" border="border-blue-100 dark:border-blue-900" valueColor="text-blue-500" subColor="text-blue-400" />
            <StatCard value={readAgainExternalCount} internalExtra={readAgainInternalExtra} label="Read Again" bg="bg-violet-50 dark:bg-violet-950/20" border="border-violet-100 dark:border-violet-900" valueColor="text-violet-500" subColor="text-violet-400" />
          </div>

          {/* Internal summary pill */}
          {totalInternal > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">{totalInternal}</span> internal email{totalInternal > 1 ? "s" : ""} from <span className="font-medium">saigontechnology.com</span> — shown separately below each section
              </span>
            </div>
          )}

          {/* All clear */}
          {total === 0 && (
            <div className="text-center py-2">
              <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-500">Inbox all clear 🎉</p>
              {actionedIds.size > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">{actionedIds.size} email{actionedIds.size > 1 ? "s" : ""} actioned this session</p>
              )}
            </div>
          )}

          {/* Collapsible sections — only visible (non-actioned) items */}
          {total > 0 && (
            <div className="space-y-1">
              <CollapsibleSection
                label="Missed Replies" icon={AlertCircle} color="text-red-500"
                items={missed} totalCount={missedCount}
                defaultOpen={missedExternalCount > 0}
                onDone={markActioned} onCreateTask={handleCreateTask}
              />
              <CollapsibleSection
                label="Needs Reply" icon={Mail} color="text-amber-500"
                items={needs} totalCount={needsCount}
                defaultOpen={missedExternalCount === 0 && needsExternalCount > 0}
                onDone={markActioned} onCreateTask={handleCreateTask}
              />
              <CollapsibleSection
                label="Follow Up" icon={RotateCcw} color="text-blue-500"
                items={follow} totalCount={followCount}
                defaultOpen={missedExternalCount === 0 && needsExternalCount === 0}
                onDone={markActioned} onCreateTask={handleCreateTask}
              />
              <CollapsibleSection
                label="Read Again" icon={MailOpen} color="text-violet-500"
                items={readAgain} totalCount={readAgainCount}
                defaultOpen={missedExternalCount === 0 && needsExternalCount === 0 && followExternalCount === 0}
                onDone={markActioned} onCreateTask={handleCreateTask}
              />
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-gray-800">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="w-2.5 h-2.5" />
              {syncLabel ? `Last scan: ${syncLabel}` : "Not yet scanned"}
              {actionedIds.size > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[9px] font-medium">
                  <Check className="w-2 h-2" />{actionedIds.size} actioned
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-400 text-right">
              <div>
                {digest?.noReplyFiltered ?? 0} no-reply filtered
                {digest?.totalScanned ? ` · ${digest.totalScanned} scanned` : ""}
              </div>
              <div className="flex items-center justify-end gap-1">
                <Globe className="w-2.5 h-2.5" />
                <span>{totalExternal} external</span>
                {totalInternal > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <Building2 className="w-2.5 h-2.5" />
                    <span>{totalInternal} internal</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Link to full Microsoft hub */}
          <Link
            href="/microsoft"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[10px] text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border border-blue-100 dark:border-blue-900"
          >
            <MailOpen className="w-3 h-3" /> Open full inbox
          </Link>
        </div>
      )}
    </div>
  );
}
