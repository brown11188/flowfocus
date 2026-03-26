"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Mail, Calendar, RefreshCw, Unlink,
  CheckCircle2, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MicrosoftConnection {
  id: string;
  email: string | null;
  displayName: string | null;
  syncEmailsEnabled: boolean;
  syncCalendarEnabled: boolean;
  lastEmailSyncAt: string | null;
  lastCalendarSyncAt: string | null;
  createdAt: string;
}

interface EmailItem {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  receivedDateTime: string;
  isRead: boolean;
  isMeetingInvite: boolean;
  from: { name: string | null; email: string | null } | null;
  webLink: string | null;
}

interface CalendarEvent {
  id: string;
  subject: string | null;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location: { displayName: string } | null;
  webLink: string | null;
  isAllDay: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MicrosoftConnectPanel() {
  const searchParams = useSearchParams();
  const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // State
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<MicrosoftConnection | null>(null);
  const [justConnected, setJustConnected] = useState(false);

  const [showEmails, setShowEmails] = useState(false);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [syncingEmails, setSyncingEmails] = useState(false);
  const [convertingEmail, setConvertingEmail] = useState<string | null>(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  // ─── Fetch connection status ─────────────────────────────────────────────

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/status`);
      if (res.ok) {
        const data = await res.json();
        setConnection(data.connection ?? null);
      } else {
        setConnection(null);
      }
    } catch {
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, [BASE_PATH]);

  // On mount: detect OAuth redirect & fetch status
  useEffect(() => {
    const connected = searchParams.get("microsoft_connected");
    if (connected === "true") {
      setJustConnected(true);
      // Remove query param from URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("microsoft_connected");
      window.history.replaceState({}, "", url.toString());
      toast.success("Microsoft account connected successfully!", { duration: 4000 });
    }
    fetchStatus();
  }, [searchParams, fetchStatus]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleConnect = () => {
    // Use the dedicated /connect endpoint to preserve the current session.
    // signIn() would create a new session for the Microsoft identity — wrong.
    // /connect does PKCE OAuth and saves MicrosoftConnection for the current userId.
    window.location.href = `${BASE_PATH}/api/microsoft/connect`;
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/status`, { method: "DELETE" });
      if (res.ok) {
        setConnection(null);
        setEmails([]);
        setEvents([]);
        setJustConnected(false);
        toast.success("Microsoft account disconnected");
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  const handleSyncEmails = async () => {
    setSyncingEmails(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails ?? []);
        setShowEmails(true);
        if (connection) {
          setConnection({ ...connection, lastEmailSyncAt: new Date().toISOString() });
        }
        toast.success(`Fetched ${data.emails?.length ?? 0} emails`);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to fetch emails");
      }
    } catch {
      toast.error("Failed to fetch emails");
    } finally {
      setSyncingEmails(false);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/sync-calendar`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Also fetch events for display
        const evRes = await fetch(`${BASE_PATH}/api/microsoft/calendar`);
        if (evRes.ok) {
          const evData = await evRes.json();
          setEvents(evData.events ?? []);
        }
        setShowCalendar(true);
        if (connection) {
          setConnection({ ...connection, lastCalendarSyncAt: new Date().toISOString() });
        }
        toast.success(`Synced ${data.synced ?? 0} calendar events`);
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to sync calendar");
      }
    } catch {
      toast.error("Failed to sync calendar");
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleConvertEmail = async (email: EmailItem) => {
    setConvertingEmail(email.id);
    try {
      const res = await fetch(`${BASE_PATH}/api/microsoft/convert-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ microsoftId: email.id }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Created task: "${data.task.title}"`);
        window.dispatchEvent(new CustomEvent("friday:task-created"));
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to convert email");
      }
    } catch {
      toast.error("Failed to convert email");
    } finally {
      setConvertingEmail(null);
    }
  };

  const patchSync = async (patch: Partial<Pick<MicrosoftConnection, "syncEmailsEnabled" | "syncCalendarEnabled">>) => {
    const res = await fetch(`${BASE_PATH}/api/microsoft/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return res.ok;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking connection status&hellip;
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Just-connected success banner ── */}
      {justConnected && connection && (
        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">Microsoft account connected!</p>
            <p className="text-xs text-green-700 dark:text-green-400 mt-0.5 truncate">
              Signed in as <strong>{connection.displayName ?? connection.email ?? "Microsoft User"}</strong>
            </p>
          </div>
          <button
            onClick={() => setJustConnected(false)}
            className="flex-shrink-0 text-green-500 hover:text-green-700 dark:hover:text-green-300 text-xl leading-none"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* MS logo */}
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            connection ? "bg-[#0078D4]" : "bg-gray-100 dark:bg-gray-800"
          )}>
            <svg viewBox="0 0 23 23" className="w-5 h-5">
              <path fill={connection ? "#fff" : "#f35325"} d="M0 0h11v11H0z"/>
              <path fill={connection ? "#fff" : "#81bc06"} d="M12 0h11v11H12z"/>
              <path fill={connection ? "#fff" : "#05a6f0"} d="M0 12h11v11H0z"/>
              <path fill={connection ? "#fff" : "#ffba08"} d="M12 12h11v11H12z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Microsoft Account</h3>
              {connection ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Not connected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {connection
                ? `${connection.displayName ?? connection.email ?? "Microsoft User"} \u00b7 connected ${new Date(connection.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : "Sync Outlook email & calendar with FlowFocus"}
            </p>
          </div>
        </div>

        {/* Action button */}
        {connection ? (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
          >
            <Unlink className="w-3.5 h-3.5" />
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] rounded-xl transition-colors shadow-sm"
          >
            <svg viewBox="0 0 23 23" className="w-4 h-4">
              <path fill="#fff" d="M0 0h11v11H0z"/>
              <path fill="#fff" d="M12 0h11v11H12z"/>
              <path fill="#fff" d="M0 12h11v11H0z"/>
              <path fill="#fff" d="M12 12h11v11H12z"/>
            </svg>
            Sign in with Microsoft
          </button>
        )}
      </div>

      {/* ── Not connected: feature preview ── */}
      {!connection && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
            <Mail className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Email &#8594; Task</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Convert Outlook emails into tasks with AI summaries</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900">
            <Calendar className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">Calendar Sync</p>
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">Sync tasks with due dates to Outlook Calendar</p>
            </div>
          </div>
        </div>
      )}

      {connection && (
        <>
          {/* ── Account detail card ── */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Account</span>
              <button
                onClick={() => fetchStatus(true)}
                className="text-xs text-gray-400 hover:text-violet-500 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#0078D4] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(connection.displayName ?? connection.email ?? "M")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {connection.displayName ?? "Microsoft User"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{connection.email}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
            </div>
            {/* Last sync timestamps */}
            {(connection.lastEmailSyncAt || connection.lastCalendarSyncAt) && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
                {connection.lastEmailSyncAt && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Last email sync: {formatDate(connection.lastEmailSyncAt)}
                  </p>
                )}
                {connection.lastCalendarSyncAt && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Last calendar sync: {formatDate(connection.lastCalendarSyncAt)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Sync toggles ── */}
          <div className="flex gap-3">
            <button
              onClick={async () => {
                const next = !connection.syncEmailsEnabled;
                const ok = await patchSync({ syncEmailsEnabled: next });
                if (ok) {
                  setConnection({ ...connection, syncEmailsEnabled: next });
                  toast.success(next ? "Email sync enabled" : "Email sync disabled");
                }
              }}
              className={cn(
                "flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all text-sm font-medium",
                connection.syncEmailsEnabled
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
              )}
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span>Email sync</span>
              <span className={cn(
                "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                connection.syncEmailsEnabled
                  ? "bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              )}>
                {connection.syncEmailsEnabled ? "ON" : "OFF"}
              </span>
            </button>

            <button
              onClick={async () => {
                const next = !connection.syncCalendarEnabled;
                const ok = await patchSync({ syncCalendarEnabled: next });
                if (ok) {
                  setConnection({ ...connection, syncCalendarEnabled: next });
                  toast.success(next ? "Calendar sync enabled" : "Calendar sync disabled");
                }
              }}
              className={cn(
                "flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all text-sm font-medium",
                connection.syncCalendarEnabled
                  ? "border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
              )}
            >
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Calendar sync</span>
              <span className={cn(
                "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                connection.syncCalendarEnabled
                  ? "bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500"
              )}>
                {connection.syncCalendarEnabled ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          {/* ── Email accordion ── */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowEmails(!showEmails)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Recent Emails</span>
                {emails.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                    {emails.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); handleSyncEmails(); }}
                  disabled={syncingEmails}
                  title="Fetch emails"
                  className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 text-blue-500", syncingEmails && "animate-spin")} />
                </button>
                {showEmails
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>
            {showEmails && (
              <div className="border-t border-gray-100 dark:border-gray-800 max-h-[380px] overflow-y-auto">
                {emails.length === 0 ? (
                  <div className="p-8 text-center">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm font-medium text-gray-500">No emails fetched yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click the refresh icon above to load your recent inbox</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/80">
                    {emails.map((email) => (
                      <div key={email.id} className="p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {!email.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {email.subject || "(No subject)"}
                              </span>
                              {email.isMeetingInvite && (
                                <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded font-medium">
                                  Meeting
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-1">
                              {email.from?.name ?? email.from?.email ?? "Unknown"} &middot; {formatDate(email.receivedDateTime)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleConvertEmail(email)}
                            disabled={convertingEmail === email.id}
                            title="Convert to task"
                            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/60 rounded-lg transition-colors disabled:opacity-40"
                          >
                            {convertingEmail === email.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                Task
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Calendar accordion ── */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Calendar Events</span>
                {events.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 rounded-full">
                    {events.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); handleSyncCalendar(); }}
                  disabled={syncingCalendar}
                  title="Fetch calendar events"
                  className="p-1.5 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-lg transition-colors"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 text-violet-500", syncingCalendar && "animate-spin")} />
                </button>
                {showCalendar
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>
            {showCalendar && (
              <div className="border-t border-gray-100 dark:border-gray-800 max-h-[380px] overflow-y-auto">
                {events.length === 0 ? (
                  <div className="p-8 text-center">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm font-medium text-gray-500">No events fetched yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click the refresh icon above to load your Outlook Calendar</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/80">
                    {events.map((event) => (
                      <div key={event.id} className="p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {event.subject || "(No title)"}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(event.start.dateTime).toLocaleDateString("en-US", {
                                weekday: "short", month: "short", day: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                              {event.location?.displayName && (
                                <span className="ml-1">&middot; {event.location.displayName}</span>
                              )}
                            </p>
                          </div>
                          {event.webLink && (
                            <a
                              href={event.webLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open in Outlook"
                              className="flex-shrink-0 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
