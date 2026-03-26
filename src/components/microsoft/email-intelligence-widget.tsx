"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import {
  Mail, RefreshCw, AlertCircle, Clock, RotateCcw,
  ExternalLink, ChevronDown, ChevronUp, Sparkles,
  MailOpen, CheckCircle2, ShieldAlert,
  Tag, Building2, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────────────────

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

// ─── Sub-Components ───────────────────────────────────────────────────────────────────

function EmailItemCard({ item, urgency }: { item: EmailDigestItem; urgency: "high" | "medium" | "low" }) {
  const uc = URGENCY_CONFIG[urgency];
  const initials = (item.fromName ?? item.fromEmail ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className={cn("rounded-lg border p-2.5 text-sm", uc.bg, uc.border)}>
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white mt-0.5",
          urgency === "high" ? "bg-red-500" : urgency === "medium" ? "bg-amber-500" : "bg-gray-400"
        )}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-medium text-gray-900 dark:text-white text-xs leading-snug truncate">
              {item.subject ?? "(no subject)"}
            </p>
            {item.webLink && (
              <a
                href={item.webLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {item.fromName ?? item.fromEmail ?? "Unknown"}
            {item.clientLabel && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-medium">
                <Tag className="w-2 h-2" />{item.clientLabel}
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
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({
  label, icon: Icon, color, items, defaultOpen = false, totalCount,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  items: EmailDigestItem[];
  defaultOpen?: boolean;
  totalCount: number; // true count from DB (never capped)
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (totalCount === 0) return null;
  // Items may contain both Internal and External — split them
  const externalItems = items.filter(i => i.clientLabel !== "Internal");
  const internalItems = items.filter(i => i.clientLabel === "Internal");
  const externalCount = externalItems.length;
  const internalCount = internalItems.length;
  const hasMore = totalCount > items.length;

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
      >
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", color)} />
        <span className={cn("text-xs font-semibold", color)}>{label}</span>
        {/* External badge */}
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
        {/* Internal badge */}
        {internalCount > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            +{internalCount} internal
          </span>
        )}
        {hasMore && (
          <span className="text-[9px] text-gray-400 font-normal">
            (showing {items.length})
          </span>
        )}
        <span className="flex-1" />
        {open ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 pl-1">
          {/* External emails first */}
          {externalItems.length > 0 && (
            <div className="space-y-1.5">
              {internalItems.length > 0 && (
                <div className="flex items-center gap-1 text-[9px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">
                  <Globe className="w-2.5 h-2.5" /> External
                </div>
              )}
              {externalItems.map(item => (
                <EmailItemCard key={item.id} item={item} urgency={item.urgency ?? "medium"} />
              ))}
            </div>
          )}
          {/* Internal emails in a collapsible sub-section */}
          {internalItems.length > 0 && (
            <InternalSubSection items={internalItems} />
          )}
          {hasMore && (
            <div className="text-[10px] text-gray-400 italic text-center py-1">
              … and {totalCount - items.length} more. Open full inbox to see all.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InternalSubSection({ items }: { items: EmailDigestItem[] }) {
  const [open, setOpen] = useState(false);
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
            <EmailItemCard key={item.id} item={item} urgency={item.urgency ?? "medium"} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────
function StatCard({
  value, total, label, bg, border, valueColor, subColor,
}: {
  value: number;
  total: number;
  label: string;
  bg: string;
  border: string;
  valueColor: string;
  subColor: string;
}) {
  const internalCount = total - value;
  return (
    <div className={cn("rounded-lg border p-2 text-center", bg, border)}>
      <div className={cn("text-lg font-bold", valueColor)}>{value}</div>
      <div className={cn("text-[9px] font-medium leading-tight mt-0.5", subColor)}>{label}</div>
      {internalCount > 0 && (
        <div className="text-[8px] text-slate-400 mt-0.5">+{internalCount} internal</div>
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

// ─── Main Widget ───────────────────────────────────────────────────────────────────────────

export function EmailIntelligenceWidget() {
  const [digest, setDigest] = useState<EmailDigest | null>(null);
  const [connection, setConnection] = useState<EmailConnection | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null); // null = loading
  const [isScanning, setIsScanning] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const loadDigest = async () => {
    try {
      const res = await apiFetch("/api/microsoft/email-digest");
      if (!res.ok) return;
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected) {
        setConnection(data.connection);
        setDigest(data.digest);
      }
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    void loadDigest();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await apiFetch("/api/microsoft/email-scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
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

  // ─── Summary counts ───
  const missed = digest?.missedReplies ?? [];
  const needs = digest?.needsReply ?? [];
  const follow = digest?.followUp ?? [];
  const readAgain = digest?.readAgain ?? [];

  // For the stats grid, only count External emails (Internal shown separately)
  const missedExternal = missed.filter((i: EmailDigestItem) => i.clientLabel !== "Internal");
  const needsExternal  = needs.filter((i: EmailDigestItem)  => i.clientLabel !== "Internal");
  const followExternal = follow.filter((i: EmailDigestItem) => i.clientLabel !== "Internal");
  const readAgainExternal = readAgain.filter((i: EmailDigestItem) => i.clientLabel !== "Internal");

  // True DB counts — may include internal; we show separate breakdown below
  const missedCount    = digest?.missedReplyCount ?? missed.length;
  const needsCount     = digest?.needsReplyCount  ?? needs.length;
  const followCount    = digest?.followUpCount    ?? follow.length;
  const readAgainCount = digest?.readAgainCount   ?? readAgain.length;

  // External-only counts for the badge (what user should act on)
  const missedExternalCount    = missedExternal.length;
  const needsExternalCount     = needsExternal.length;
  const followExternalCount    = followExternal.length;
  const readAgainExternalCount = readAgainExternal.length;
  const totalExternal = missedExternalCount + needsExternalCount + followExternalCount + readAgainExternalCount;
  const total = missedCount + needsCount + followCount + readAgainCount;
  const isScanned = digest?.status === "done";
  const scanDate = digest?.scanDate;
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
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
      ? `Today ${lastSync.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : lastSync.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-b border-gray-100 dark:border-gray-800">
        <Mail className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex-1">Email Intelligence</span>
        <div className="flex items-center gap-1">
          {/* Rules toggle */}
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
          {/* Scan button */}
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

      {/* Status / Not scanned yet */}
      {!isScanned && !isScanning && (
        <div className="px-4 py-4 text-center space-y-2">
          {digest?.status === "error" ? (
            <>
              <AlertCircle className="w-7 h-7 text-red-400 mx-auto" />
              <p className="text-xs text-red-500">{digest.errorMessage ?? "Scan failed"}</p>
              <button
                onClick={handleScan}
                className="text-xs text-blue-500 hover:underline"
              >Try again</button>
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

      {/* Scanning state */}
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

          {/* Stats row — External counts (primary action items) */}
          <div className="grid grid-cols-4 gap-1.5">
            <StatCard value={missedExternalCount} total={missedCount} label="Missed" bg="bg-red-50 dark:bg-red-950/20" border="border-red-100 dark:border-red-900" valueColor="text-red-500" subColor="text-red-400" />
            <StatCard value={needsExternalCount} total={needsCount} label="Needs Reply" bg="bg-amber-50 dark:bg-amber-950/20" border="border-amber-100 dark:border-amber-900" valueColor="text-amber-500" subColor="text-amber-400" />
            <StatCard value={followExternalCount} total={followCount} label="Follow Up" bg="bg-blue-50 dark:bg-blue-950/20" border="border-blue-100 dark:border-blue-900" valueColor="text-blue-500" subColor="text-blue-400" />
            <StatCard value={readAgainExternalCount} total={readAgainCount} label="Read Again" bg="bg-violet-50 dark:bg-violet-950/20" border="border-violet-100 dark:border-violet-900" valueColor="text-violet-500" subColor="text-violet-400" />
          </div>
          {/* Internal summary pill — shown only when there are internal items */}
          {(total - totalExternal) > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">{total - totalExternal}</span> internal email{(total - totalExternal) > 1 ? "s" : ""} from <span className="font-medium">saigontechnology.com</span> — shown separately below each section
              </span>
            </div>
          )}

          {/* All clear — only when truly nothing, including internal */}
          {total === 0 && (
            <div className="text-center py-2">
              <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-500">Inbox all clear 🎉</p>
            </div>
          )}

          {/* Collapsible sections */}
          {total > 0 && (
            <div className="space-y-1">
              <CollapsibleSection
                label="Missed Replies"
                icon={AlertCircle}
                color="text-red-500"
                items={missed}
                totalCount={missedCount}
                defaultOpen={missedExternalCount > 0}
              />
              <CollapsibleSection
                label="Needs Reply"
                icon={Mail}
                color="text-amber-500"
                items={needs}
                totalCount={needsCount}
                defaultOpen={missedExternalCount === 0 && needsExternalCount > 0}
              />
              <CollapsibleSection
                label="Follow Up"
                icon={RotateCcw}
                color="text-blue-500"
                items={follow}
                totalCount={followCount}
                defaultOpen={missedExternalCount === 0 && needsExternalCount === 0}
              />
              <CollapsibleSection
                label="Read Again"
                icon={MailOpen}
                color="text-violet-500"
                items={readAgain}
                totalCount={readAgainCount}
                defaultOpen={missedExternalCount === 0 && needsExternalCount === 0 && followExternalCount === 0}
              />
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-gray-800">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="w-2.5 h-2.5" />
              {syncLabel ? `Last scan: ${syncLabel}` : "Not yet scanned"}
            </div>
            <div className="text-[10px] text-gray-400 text-right">
              <div>
                {digest?.noReplyFiltered ?? 0} no-reply filtered
                {digest?.totalScanned ? ` · ${digest.totalScanned} scanned` : ""}
              </div>
              <div className="flex items-center justify-end gap-1">
                <Globe className="w-2.5 h-2.5" />
                <span>{totalExternal} external</span>
                {(total - totalExternal) > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <Building2 className="w-2.5 h-2.5" />
                    <span>{total - totalExternal} internal</span>
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
