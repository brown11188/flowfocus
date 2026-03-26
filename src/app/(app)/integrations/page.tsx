"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Link2, ExternalLink, CheckCircle2, XCircle, Loader2, Zap, Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClickUpStatus {
  connected: boolean;
  workspaces?: { id: string; name: string }[];
  lastSynced?: string | null;
}
interface MicrosoftStatus {
  connected: boolean;
  email?: string | null;
  emailSync?: boolean;
  calendarSync?: boolean;
  lastEmailSync?: string | null;
  lastCalendarSync?: string | null;
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IntegrationsPage() {
  const [clickup, setClickup] = useState<ClickUpStatus | null>(null);
  const [microsoft, setMicrosoft] = useState<MicrosoftStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cuRes, msRes] = await Promise.all([
          apiFetch("/api/clickup/status"),
          apiFetch("/api/microsoft/status"),
        ]);
        const cuData = await cuRes.json();
        const msData = await msRes.json();
        setClickup({
          connected: !!(cuData.connection),
          workspaces: cuData.workspaces ?? [],
          lastSynced: cuData.workspaces?.[0]?.lastSyncedAt ?? null,
        });
        setMicrosoft({
          connected: msData.connected ?? false,
          email: msData.connection?.email ?? null,
          emailSync: msData.connection?.syncEmailsEnabled ?? false,
          calendarSync: msData.connection?.syncCalendarEnabled ?? false,
          lastEmailSync: msData.connection?.lastEmailSyncAt ?? null,
          lastCalendarSync: msData.connection?.lastCalendarSyncAt ?? null,
        });
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const connectedCount = [clickup?.connected, microsoft?.connected].filter(Boolean).length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integrations</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect your tools to supercharge FlowFocus
              </p>
            </div>
          </div>
          {!loading && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
              connectedCount > 0
                ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500"
            )}>
              <CheckCircle2 className="w-4 h-4" />
              {connectedCount} connected
            </div>
          )}
        </div>

        {/* Active services */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Connected Services</h2>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* ClickUp Card */}
              <div className={cn(
                "rounded-2xl border p-6 bg-white dark:bg-gray-900 shadow-sm transition-all hover:shadow-md",
                clickup?.connected ? "border-[#7B68EE]/30" : "border-gray-200 dark:border-gray-800"
              )}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#7B68EE]/10 flex items-center justify-center">
                      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
                        <path d="M4.53 21.4L8.2 18.4c1.95 2.3 3.9 3.46 7.8 3.46s5.85-1.16 7.8-3.46l3.67 3c-2.73 3.2-6.4 4.87-11.47 4.87S7.26 24.6 4.53 21.4z" fill="#7B68EE"/>
                        <path d="M4 11.2l3.78 2.87C9.9 11.5 12.7 10.1 16 10.1s6.1 1.4 8.22 3.97L28 11.2C25.13 7.7 20.9 5.67 16 5.67S6.87 7.7 4 11.2z" fill="#FF79C6"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">ClickUp</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Task & project sync</p>
                    </div>
                  </div>
                  {clickup?.connected ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      <XCircle className="w-3.5 h-3.5" /> Not connected
                    </span>
                  )}
                </div>

                {clickup?.connected ? (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Zap className="w-3.5 h-3.5 text-[#7B68EE]" />
                      <span>{clickup.workspaces?.length ?? 0} workspace{(clickup.workspaces?.length ?? 0) !== 1 ? "s" : ""} connected</span>
                    </div>
                    {clickup.lastSynced && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        Last sync: {timeAgo(clickup.lastSynced)}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Import tasks from ClickUp workspaces and generate AI-powered workspace reports.
                  </p>
                )}

                <Link
                  href="/clickup"
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                    clickup?.connected
                      ? "bg-[#7B68EE] hover:bg-[#6B58DE] text-white"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {clickup?.connected ? "Manage" : "Connect"}
                </Link>
              </div>

              {/* Microsoft Card */}
              <div className={cn(
                "rounded-2xl border p-6 bg-white dark:bg-gray-900 shadow-sm transition-all hover:shadow-md",
                microsoft?.connected ? "border-[#0078D4]/30" : "border-gray-200 dark:border-gray-800"
              )}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#0078D4]/10 flex items-center justify-center">
                      <svg viewBox="0 0 23 23" className="w-6 h-6">
                        <path fill="#f35325" d="M0 0h11v11H0z"/>
                        <path fill="#81bc06" d="M12 0h11v11H12z"/>
                        <path fill="#05a6f0" d="M0 12h11v11H0z"/>
                        <path fill="#ffba08" d="M12 12h11v11H12z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Microsoft 365</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Outlook & Calendar</p>
                    </div>
                  </div>
                  {microsoft?.connected ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      <XCircle className="w-3.5 h-3.5" /> Not connected
                    </span>
                  )}
                </div>

                {microsoft?.connected ? (
                  <div className="space-y-2 mb-4">
                    {microsoft.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="w-3.5 h-3.5 text-[#0078D4]" />
                        <span className="truncate">{microsoft.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", microsoft.emailSync ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400")}>
                        Email {microsoft.emailSync ? "ON" : "OFF"}
                      </span>
                      <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", microsoft.calendarSync ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400")}>
                        Calendar {microsoft.calendarSync ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Convert emails to tasks and sync your Outlook Calendar with FlowFocus due dates.
                  </p>
                )}

                <Link
                  href="/microsoft"
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                    microsoft?.connected
                      ? "bg-[#0078D4] hover:bg-[#006CBE] text-white"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {microsoft?.connected ? "Manage" : "Connect"}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Coming soon */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Coming Soon</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "Notion", desc: "Sync pages and databases", color: "bg-gray-100 dark:bg-gray-800", icon: "N" },
              { name: "Slack", desc: "Create tasks from messages", color: "bg-green-50 dark:bg-green-950/30", icon: "S" },
              { name: "GitHub", desc: "Link issues and PRs to tasks", color: "bg-gray-100 dark:bg-gray-800", icon: "G" },
            ].map(svc => (
              <div key={svc.name} className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 opacity-60">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-bold text-gray-500 text-sm", svc.color)}>
                    {svc.icon}
                  </div>
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">{svc.name}</p>
                    <p className="text-xs text-gray-400">{svc.desc}</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
